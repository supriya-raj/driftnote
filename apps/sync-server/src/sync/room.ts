import {
  CLOSE_RATE_LIMITED,
  CLOSE_TOO_LARGE,
  MESSAGE_AWARENESS,
  MESSAGE_SYNC,
  NOTE_META_KEY,
  type Role,
} from "@driftnote/shared";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import type { WebSocket } from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { filterAwarenessUpdate } from "./awarenessFilter";
import { LimitError, TokenBucket } from "./limits";

/** Transaction origin for state loaded from the database (no need to save it again). */
export const STORAGE_ORIGIN = "storage";

/** What the server knows about one connection (ARCHITECTURE.md, section 7.1). */
export interface Connection {
  readonly socket: WebSocket;
  /** Which token this connection used (for revocation) and what it may do. */
  readonly tokenId: number;
  readonly role: Role;
  /** Update rate limit for this connection (ADR 011). */
  readonly updates: TokenBucket;
  /** Presence client IDs this connection controls, removed for everyone when it closes. */
  readonly awarenessIds: Set<number>;
  /** Whether this connection has been sent everyone's presence yet (after its content). */
  presenceSent: boolean;
}

interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

/**
 * The in-memory meeting place for one note: the server's copy of the doc, presence, and
 * the open connections. Changes are applied to `doc`; the doc's update event forwards each
 * change to every other connection (the change's origin is the socket it came from).
 */
export class Room {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  readonly connections = new Map<WebSocket, Connection>();
  /** Changed since the last save (ARCHITECTURE.md, section 7.3). */
  dirty = false;
  /** Called after any change that needs saving (not for state loaded from storage). */
  onChange: () => void = () => undefined;

  private readonly maxBufferedBytes: number;
  private readonly maxDocumentBytes: number;
  /**
   * Upper bound on the note's encoded size: exact after each save, plus the size of every
   * update applied since. Merging only shrinks things, so this never under-counts, and it
   * avoids re-encoding the whole note on every keystroke.
   */
  private estimatedBytes = 0;

  constructor(
    readonly noteId: string,
    options: { maxBufferedBytes?: number; maxDocumentBytes?: number } = {},
  ) {
    this.maxBufferedBytes = options.maxBufferedBytes ?? Number.POSITIVE_INFINITY;
    this.maxDocumentBytes = options.maxDocumentBytes ?? Number.POSITIVE_INFINITY;
    // The server relays presence; it is not a participant itself.
    this.awareness.setLocalState(null);
    this.doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
  }

  /** The note's `meta.schemaVersion` (ADR 012), stored alongside the state. */
  get schemaVersion(): number {
    const value = this.doc.getMap(NOTE_META_KEY).get("schemaVersion");
    return typeof value === "number" ? value : 1;
  }

  get isEmpty(): boolean {
    return this.connections.size === 0;
  }

  /** Adds a connection and starts the sync handshake with it. */
  join(socket: WebSocket, grant: { tokenId: number; role: Role }, updates: TokenBucket): void {
    this.connections.set(socket, {
      socket,
      ...grant,
      updates,
      awarenessIds: new Set(),
      presenceSent: false,
    });

    // "Here is what I have": the client answers with what the server is missing (step 2)
    // and sends its own step 1, which the server answers with what the client is missing.
    const sync = encoding.createEncoder();
    encoding.writeVarUint(sync, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(sync, this.doc);
    this.send(socket, encoding.toUint8Array(sync));

    // Everyone's presence is sent after this client's first sync step 1 has been answered
    // (see receiveSync), so the content arrives before any cursor that points into it.
  }

  /** Handles one binary message from a connection. */
  receive(socket: WebSocket, message: Uint8Array): void {
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);
    switch (type) {
      case MESSAGE_SYNC:
        this.receiveSync(socket, decoder);
        break;
      case MESSAGE_AWARENESS: {
        // A connection may only speak for presence entries it introduced itself, so no one
        // can overwrite another person's name or cursor.
        const update = filterAwarenessUpdate(decoding.readVarUint8Array(decoder), (clientId) => {
          const owner = this.presenceOwner(clientId);
          return owner === undefined || owner === socket;
        });
        if (update) awarenessProtocol.applyAwarenessUpdate(this.awareness, update, socket);
        break;
      }
      default:
        // Unknown message types are ignored, so newer clients can add optional messages.
        break;
    }
  }

  /**
   * The role filter (ARCHITECTURE.md, section 6.1). Everyone may ask what they are missing
   * (step 1). Only owner and edit connections may change the note (step 2 and updates);
   * a view connection's changes are dropped, so nothing it sends can alter the note.
   */
  private receiveSync(socket: WebSocket, decoder: decoding.Decoder): void {
    const canWrite = this.connections.get(socket)?.role !== "view";
    const subtype = decoding.readVarUint(decoder);
    switch (subtype) {
      case syncProtocol.messageYjsSyncStep1: {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MESSAGE_SYNC);
        syncProtocol.readSyncStep1(decoder, reply, this.doc);
        this.send(socket, encoding.toUint8Array(reply));
        this.sendPresenceOnce(socket);
        break;
      }
      case syncProtocol.messageYjsSyncStep2:
      case syncProtocol.messageYjsUpdate: {
        const update = decoding.readVarUint8Array(decoder);
        if (!canWrite) break;
        this.checkLimits(socket, update);
        // The socket is the origin, so the change is forwarded to everyone else.
        Y.applyUpdate(this.doc, update, socket);
        this.estimatedBytes += update.length;
        break;
      }
      default:
        throw new Error(`Unknown sync message type ${String(subtype)}`);
    }
  }

  /** Rejects (before applying) a change that would break the rate or size limit. */
  private checkLimits(socket: WebSocket, update: Uint8Array): void {
    if (this.connections.get(socket)?.updates.take() === false) {
      throw new LimitError(CLOSE_RATE_LIMITED, "update rate limit");
    }
    if (this.estimatedBytes + update.length > this.maxDocumentBytes) {
      // Exact check before refusing: the running estimate may over-count.
      const exact = Y.encodeStateAsUpdate(this.doc).length;
      this.estimatedBytes = exact;
      if (exact + update.length > this.maxDocumentBytes) {
        throw new LimitError(CLOSE_TOO_LARGE, "document size limit");
      }
    }
  }

  /** Records the exact encoded size after a save or load. */
  setEncodedSize(bytes: number): void {
    this.estimatedBytes = bytes;
  }

  /**
   * Sends everyone's presence to a connection, once, right after its content. A cursor
   * that arrives before the content it points into makes the editor's cursor plugin throw
   * ("position out of range"), which also stops the content from rendering.
   */
  private sendPresenceOnce(socket: WebSocket): void {
    const connection = this.connections.get(socket);
    if (!connection || connection.presenceSent) return;
    connection.presenceSent = true;
    const states = this.awareness.getStates();
    if (states.size > 0) this.send(socket, this.encodeAwareness([...states.keys()]));
  }

  /** The connection that introduced this presence entry, if any is still connected. */
  private presenceOwner(clientId: number): WebSocket | undefined {
    for (const connection of this.connections.values()) {
      if (connection.awarenessIds.has(clientId)) return connection.socket;
    }
    return undefined;
  }

  /** Sends one message to every connection in the room. */
  broadcast(message: Uint8Array): void {
    for (const socket of this.connections.keys()) this.send(socket, message);
  }

  /** Sends one message to a single connection. */
  sendTo(socket: WebSocket, message: Uint8Array): void {
    this.send(socket, message);
  }

  /** Removes a connection and the presence it controlled. */
  leave(socket: WebSocket): void {
    const connection = this.connections.get(socket);
    if (!connection) return;
    this.connections.delete(socket);
    awarenessProtocol.removeAwarenessStates(this.awareness, [...connection.awarenessIds], null);
  }

  destroy(): void {
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.destroy();
    this.doc.destroy();
  }

  private readonly onDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin !== STORAGE_ORIGIN) {
      this.dirty = true;
      this.onChange();
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    for (const socket of this.connections.keys()) {
      if (socket !== origin) this.send(socket, message);
    }
  };

  private readonly onAwarenessUpdate = (change: AwarenessChange, origin: unknown): void => {
    const changed = [...change.added, ...change.updated, ...change.removed];
    // Remember which presence entries each connection controls, for cleanup on close.
    const connection =
      origin !== null && typeof origin === "object"
        ? this.connections.get(origin as WebSocket)
        : undefined;
    if (connection) {
      for (const id of change.added) connection.awarenessIds.add(id);
      for (const id of change.removed) connection.awarenessIds.delete(id);
    }
    const message = this.encodeAwareness(changed);
    for (const socket of this.connections.keys()) this.send(socket, message);
  };

  /**
   * Sends unless the socket is closed. A client whose unsent data keeps growing cannot keep
   * up; it is closed (it will reconnect and catch up) rather than eat the server's memory.
   */
  private send(socket: WebSocket, message: Uint8Array): void {
    if (socket.readyState !== socket.OPEN) return;
    if (socket.bufferedAmount > this.maxBufferedBytes) {
      socket.close(1013, "too slow, reconnect");
      return;
    }
    socket.send(message);
  }

  private encodeAwareness(clientIds: number[]): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIds),
    );
    return encoding.toUint8Array(encoder);
  }
}
