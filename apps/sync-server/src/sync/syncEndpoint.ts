import { encodeAckMessage, isNoteId, type Role } from "@driftnote/shared";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import * as Y from "yjs";
import type { AuthResult } from "./auth";
import { Room, STORAGE_ORIGIN } from "./room";
import { realTimers, type Timers } from "./timers";

const SYNC_PATH = /^\/sync\/([^/]+)$/;

export interface SyncOptions {
  /**
   * Connect-time checks (protocol version, tombstone, token). Defaults to letting every
   * connection edit, for tests that are not about auth.
   */
  readonly authorize?: (noteId: string, params: URLSearchParams) => AuthResult;
  /** Loads a note's saved state (null if the server has never seen it). */
  readonly loadNote?: (noteId: string) => Promise<Uint8Array | null>;
  readonly timers?: Timers;
  /** How long an empty room stays in memory, so a quick reload does not reload the note. */
  readonly unloadGraceMs?: number;
  /** How often sockets are pinged; one missed answer and the socket is terminated. */
  readonly pingIntervalMs?: number;
  /** Close sockets whose unsent data exceeds this (a client that cannot keep up). */
  readonly maxBufferedBytes?: number;
  /** Writes a note's whole state durably; called by the save scheduler. */
  readonly saveNote?: (noteId: string, state: Uint8Array, schemaVersion: number) => void;
  /**
   * Every change is saved within this long. The timer starts at the first unsaved change
   * and is not pushed back by later ones, so continuous typing still gets saved.
   */
  readonly saveDebounceMs?: number;
}

/**
 * The WebSocket endpoint `/sync/<noteId>` (ARCHITECTURE.md, sections 6.1 and 7.1). Rooms
 * live in memory, one per note with open connections. Authentication is added in T28;
 * until then every connection may edit.
 */
export class SyncEndpoint {
  readonly rooms = new Map<string, Room>();
  /** One load per note, shared by concurrent joiners (no two copies of a note in memory). */
  private readonly loading = new Map<string, Promise<Room>>();
  private readonly unloadTimers = new Map<string, unknown>();
  private readonly saveTimers = new Map<Room, unknown>();
  private readonly alive = new WeakMap<WebSocket, boolean>();
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly timers: Timers;
  private readonly pingTimer: unknown;
  private readonly loadNote: (noteId: string) => Promise<Uint8Array | null>;
  private readonly unloadGraceMs: number;
  private readonly maxBufferedBytes: number;
  private readonly saveNote: (noteId: string, state: Uint8Array, schemaVersion: number) => void;
  private readonly saveDebounceMs: number;
  private readonly authorize: (noteId: string, params: URLSearchParams) => AuthResult;

  constructor(options: SyncOptions = {}) {
    this.timers = options.timers ?? realTimers;
    this.loadNote = options.loadNote ?? (() => Promise.resolve(null));
    this.unloadGraceMs = options.unloadGraceMs ?? 30_000;
    this.maxBufferedBytes = options.maxBufferedBytes ?? 64 * 1024 * 1024;
    this.saveNote = options.saveNote ?? (() => undefined);
    this.saveDebounceMs = options.saveDebounceMs ?? 2000;
    this.authorize =
      options.authorize ?? (() => ({ ok: true, grant: { tokenId: 0, role: "edit" } }));
    this.pingTimer = this.timers.setInterval(this.pingAll, options.pingIntervalMs ?? 30_000);
  }

  attach(http: Server): void {
    http.on("upgrade", this.onUpgrade);
  }

  /** Stops the endpoint; unsaved rooms are saved first (graceful shutdown). */
  close(): void {
    this.timers.clear(this.pingTimer);
    for (const timer of this.unloadTimers.values()) this.timers.clear(timer);
    for (const room of this.rooms.values()) this.save(room);
    for (const client of this.wss.clients) client.terminate();
    for (const room of this.rooms.values()) room.destroy();
    this.rooms.clear();
    this.wss.close();
  }

  private readonly onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const { pathname, searchParams } = new URL(req.url ?? "/", "http://localhost");
    const noteId = SYNC_PATH.exec(pathname)?.[1];
    if (noteId === undefined || !isNoteId(noteId)) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    // Accept the WebSocket first, then refuse with a close code: browsers cannot read why
    // an upgrade failed, but they do receive close codes.
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      const auth = this.authorize(noteId, searchParams);
      if (!auth.ok) {
        ws.close(auth.closeCode);
        return;
      }
      this.onConnection(ws, noteId, auth.grant);
    });
  };

  private onConnection(
    ws: WebSocket,
    noteId: string,
    grant: { tokenId: number; role: Role },
  ): void {
    ws.binaryType = "nodebuffer";
    this.alive.set(ws, true);
    ws.on("pong", () => this.alive.set(ws, true));

    // Until the room is loaded, messages wait in a queue (applied in order afterwards).
    let room: Room | null = null;
    const queue: Uint8Array[] = [];
    let closed = false;

    ws.on("message", (data: RawData, isBinary: boolean) => {
      this.alive.set(ws, true); // any traffic proves the connection is alive, not only pongs
      if (!isBinary) return; // the protocol is binary only
      const message = toUint8Array(data);
      if (room) this.deliver(room, ws, message);
      else queue.push(message);
    });
    ws.on("close", () => {
      closed = true;
      if (room) this.onLeave(room, ws);
    });

    this.getRoom(noteId).then(
      (loaded) => {
        if (closed) return;
        room = loaded;
        room.join(ws, grant);
        // Nothing unsaved: the room's state *is* the saved state, so acknowledge it now.
        // Otherwise a client with nothing new would never see an ack.
        if (!room.dirty) room.sendTo(ws, encodeAckMessage(room.doc));
        for (const message of queue.splice(0)) this.deliver(room, ws, message);
      },
      (err: unknown) => {
        console.error(`sync: failed to load a note: ${String(err)}`);
        ws.close(1011, "could not load note");
      },
    );
  }

  private deliver(room: Room, ws: WebSocket, message: Uint8Array): void {
    try {
      room.receive(ws, message);
    } catch (err) {
      // A malformed message must not take the room down for everyone else.
      console.warn(`sync: dropped malformed message: ${String(err)}`);
      ws.close(1003, "malformed message");
    }
  }

  /** The note's room, loading it if needed; a join cancels a pending unload. */
  private getRoom(noteId: string): Promise<Room> {
    const unload = this.unloadTimers.get(noteId);
    if (unload !== undefined) {
      this.timers.clear(unload);
      this.unloadTimers.delete(noteId);
    }
    const existing = this.rooms.get(noteId);
    if (existing) return Promise.resolve(existing);
    const inFlight = this.loading.get(noteId);
    if (inFlight) return inFlight;

    const load = this.loadNote(noteId)
      .then((state) => {
        const room = new Room(noteId, { maxBufferedBytes: this.maxBufferedBytes });
        if (state) Y.applyUpdate(room.doc, state, STORAGE_ORIGIN);
        room.onChange = () => this.scheduleSave(room);
        this.rooms.set(noteId, room);
        return room;
      })
      .finally(() => this.loading.delete(noteId));
    this.loading.set(noteId, load);
    return load;
  }

  private onLeave(room: Room, ws: WebSocket): void {
    room.leave(ws);
    if (!room.isEmpty) return;
    // Keep the room briefly: a reload rejoins without reloading the note.
    const timer = this.timers.setTimeout(() => {
      this.unloadTimers.delete(room.noteId);
      if (!room.isEmpty || this.rooms.get(room.noteId) !== room) return;
      this.save(room); // never drop unsaved changes
      this.rooms.delete(room.noteId);
      room.destroy();
    }, this.unloadGraceMs);
    this.unloadTimers.set(room.noteId, timer);
  }

  private scheduleSave(room: Room): void {
    if (this.saveTimers.has(room)) return; // already due; later edits ride along
    const timer = this.timers.setTimeout(() => {
      this.saveTimers.delete(room);
      this.save(room);
    }, this.saveDebounceMs);
    this.saveTimers.set(room, timer);
  }

  /**
   * Writes the room's whole doc. `dirty` is cleared *before* encoding: a change arriving
   * after the encode marks the room dirty again, so it can never be lost in a gap.
   */
  private save(room: Room): void {
    const pending = this.saveTimers.get(room);
    if (pending !== undefined) {
      this.timers.clear(pending);
      this.saveTimers.delete(room);
    }
    if (!room.dirty) return;
    room.dirty = false;
    try {
      // State and ack are taken in the same synchronous step, so the ack describes exactly
      // what is written; it is sent only after the write has returned (ADR 005).
      const state = Y.encodeStateAsUpdate(room.doc);
      const ack = encodeAckMessage(room.doc);
      this.saveNote(room.noteId, state, room.schemaVersion);
      room.broadcast(ack);
    } catch (err) {
      room.dirty = true;
      console.error(`sync: saving a note failed, will retry: ${String(err)}`);
      this.scheduleSave(room);
    }
  }

  /** Terminates sockets that did not answer the previous ping (closed lids, dead links). */
  private readonly pingAll = (): void => {
    for (const ws of this.wss.clients) {
      if (this.alive.get(ws) === false) {
        ws.terminate(); // fires "close", which removes the socket's presence
        continue;
      }
      this.alive.set(ws, false);
      ws.ping();
    }
  };
}

function toUint8Array(data: RawData): Uint8Array {
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
