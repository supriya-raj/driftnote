import { isNoteId } from "@driftnote/shared";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { Room } from "./room";

const SYNC_PATH = /^\/sync\/([^/]+)$/;

/**
 * The WebSocket endpoint `/sync/<noteId>` (ARCHITECTURE.md, section 6.1). Rooms live in
 * memory, one per note with open connections. Authentication is added in T28; until then
 * every connection may edit.
 */
export class SyncEndpoint {
  readonly rooms = new Map<string, Room>();
  private readonly wss = new WebSocketServer({ noServer: true });

  attach(http: Server): void {
    http.on("upgrade", this.onUpgrade);
  }

  close(): void {
    for (const client of this.wss.clients) client.terminate();
    for (const room of this.rooms.values()) room.destroy();
    this.rooms.clear();
    this.wss.close();
  }

  private readonly onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const noteId = SYNC_PATH.exec(pathname)?.[1];
    if (noteId === undefined || !isNoteId(noteId)) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.onConnection(ws, noteId);
    });
  };

  private onConnection(ws: WebSocket, noteId: string): void {
    ws.binaryType = "nodebuffer";
    const room = this.roomFor(noteId);
    room.join(ws);

    ws.on("message", (data: RawData, isBinary: boolean) => {
      if (!isBinary) return; // the protocol is binary only
      try {
        room.receive(ws, toUint8Array(data));
      } catch (err) {
        // A malformed message must not take the room down for everyone else.
        console.warn(`sync: dropped malformed message for a note: ${String(err)}`);
        ws.close(1003, "malformed message");
      }
    });
    ws.on("close", () => {
      room.leave(ws);
      if (room.isEmpty) {
        // Saving before unload arrives with persistence (T26) and a grace period (T25).
        this.rooms.delete(noteId);
        room.destroy();
      }
    });
  }

  private roomFor(noteId: string): Room {
    let room = this.rooms.get(noteId);
    if (!room) {
      room = new Room(noteId);
      this.rooms.set(noteId, room);
    }
    return room;
  }
}

function toUint8Array(data: RawData): Uint8Array {
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
