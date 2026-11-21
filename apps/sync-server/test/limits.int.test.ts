import {
  CLOSE_RATE_LIMITED,
  CLOSE_TOO_LARGE,
  createNoteId,
  MESSAGE_SYNC,
  PROTOCOL_VERSION,
} from "@driftnote/shared";
import * as encoding from "lib0/encoding";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket as RawWebSocket } from "ws";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { startServer, type RunningServer } from "../src/server";
import type { Limits } from "../src/sync/limits";
import { connectClient, defaultTokenFor, destroyAllClients } from "./support/clients";
import { ManualTimers } from "./support/manualTimers";
import { connectionOutcome } from "./support/rawSocket";

const KB = 1024;
const SMALL: Limits = {
  maxDocumentBytes: 64 * KB,
  maxMessageBytes: 80 * KB,
  updatesPerSecond: 10,
  updateBurst: 20,
  connectionsPerIp: 50,
};

let server: RunningServer | undefined;
const sockets: RawWebSocket[] = [];
afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  destroyAllClients();
  await server?.close();
  server = undefined;
});

async function start(
  limits: Partial<Limits> = {},
  timers = new ManualTimers(),
): Promise<RunningServer> {
  server = await startServer({ port: 0, sync: { timers, limits: { ...SMALL, ...limits } } });
  return server;
}

const eventually = (assertion: () => void | Promise<void>): Promise<void> =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 });

function syncUrl(s: RunningServer, noteId: string): string {
  const query = new URLSearchParams({ t: defaultTokenFor(noteId), pv: String(PROTOCOL_VERSION) });
  return `ws://127.0.0.1:${String(s.port)}/sync/${noteId}?${query.toString()}`;
}

/** A raw socket, open and past the handshake; resolves its close code when closed. */
async function openRaw(
  s: RunningServer,
  noteId: string,
): Promise<{ ws: RawWebSocket; closed: Promise<number> }> {
  const ws = new RawWebSocket(syncUrl(s, noteId));
  sockets.push(ws);
  const closed = new Promise<number>((resolve) =>
    ws.once("close", (code: number) => resolve(code)),
  );
  await new Promise((resolve) => ws.once("message", resolve));
  return { ws, closed };
}

/** An update message inserting `bytes` characters of random-ish text. */
function updateOf(bytes: number): Uint8Array {
  const doc = new Y.Doc();
  let text = "";
  for (let i = 0; i < bytes; i++) text += String.fromCharCode(97 + ((i * 7919) % 26));
  doc.getText("t").insert(0, text);
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, Y.encodeStateAsUpdate(doc));
  return encoding.toUint8Array(encoder);
}

const docSize = (s: RunningServer, noteId: string): number =>
  s.sync.rooms.get(noteId)?.doc.getText("t").length ?? 0;

describe("limits", () => {
  it("accepts a large but legal catch-up: offline work arrives as one big message", async () => {
    const s = await start();
    const noteId = createNoteId();
    const offline = connectClient(s.port, noteId);
    offline.provider.disconnect();
    offline.text.insert(0, "x".repeat(50 * KB)); // a long offline session
    offline.provider.connect();
    await offline.synced();
    await eventually(() => {
      expect(docSize(s, noteId)).toBe(50 * KB);
    });
  });

  it("closes with 4413 when a message is over the message limit", async () => {
    const s = await start();
    const noteId = createNoteId();
    const { ws, closed } = await openRaw(s, noteId);
    ws.send(updateOf(90 * KB));
    expect(await closed).toBe(CLOSE_TOO_LARGE);
    expect(docSize(s, noteId)).toBe(0);
  });

  it("closes with 4413 when a change would grow the document past the document limit", async () => {
    const s = await start();
    const noteId = createNoteId();
    const { ws, closed } = await openRaw(s, noteId);
    ws.send(updateOf(40 * KB)); // fine on its own
    await eventually(() => {
      expect(docSize(s, noteId)).toBe(40 * KB);
    });
    ws.send(updateOf(40 * KB)); // under the message limit, but the note would pass 64 KB
    expect(await closed).toBe(CLOSE_TOO_LARGE);
    expect(docSize(s, noteId)).toBe(40 * KB); // the oversized change was not applied
  });

  it("closes with 4429 when a connection floods updates", async () => {
    const s = await start(); // time is frozen: the bucket never refills
    const noteId = createNoteId();
    const { ws, closed } = await openRaw(s, noteId);
    for (let i = 0; i < SMALL.updateBurst + 5; i++) ws.send(updateOf(10));
    expect(await closed).toBe(CLOSE_RATE_LIMITED);
  });

  it("steady editing within the rate is never limited", async () => {
    const timers = new ManualTimers();
    const s = await start({}, timers);
    const noteId = createNoteId();
    const { ws } = await openRaw(s, noteId);
    let sent = 0;
    for (let second = 0; second < 5; second++) {
      for (let i = 0; i < SMALL.updatesPerSecond; i++, sent++) ws.send(updateOf(5));
      await eventually(() => {
        expect(docSize(s, noteId)).toBe(sent * 5);
      });
      timers.advance(1000);
    }
    expect(ws.readyState).toBe(RawWebSocket.OPEN);
  });

  it("limits open connections per IP address with 4429", async () => {
    const s = await start({ connectionsPerIp: 3 });
    const noteId = createNoteId();
    const open = await Promise.all([1, 2, 3].map(() => openRaw(s, noteId)));
    expect(await connectionOutcome(syncUrl(s, noteId))).toEqual({ closed: CLOSE_RATE_LIMITED });

    open[0]?.ws.close();
    await open[0]?.closed;
    await eventually(async () => {
      expect(await connectionOutcome(syncUrl(s, noteId))).toBe("accepted");
    });
  });
});
