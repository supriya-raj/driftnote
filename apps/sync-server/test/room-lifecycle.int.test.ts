import { createNoteId, MESSAGE_AWARENESS } from "@driftnote/shared";
import * as encoding from "lib0/encoding";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket as RawWebSocket } from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import { startServer, type RunningServer } from "../src/server";
import { connectClient, defaultTokenFor, destroyAllClients } from "./support/clients";
import { ManualTimers } from "./support/manualTimers";

const GRACE_MS = 30_000;
const PING_MS = 30_000;

let server: RunningServer | undefined;
afterEach(async () => {
  destroyAllClients();
  await server?.close();
  server = undefined;
});

const eventually = (assertion: () => void): Promise<void> =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 });

/** A promise you resolve by hand, to hold a note "loading" for as long as a test needs. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function stateWithText(text: string): Uint8Array {
  const doc = new Y.Doc();
  doc.getText("t").insert(0, text);
  return Y.encodeStateAsUpdate(doc);
}

async function start(options: {
  timers: ManualTimers;
  loadNote?: (noteId: string) => Promise<Uint8Array | null>;
}): Promise<RunningServer> {
  server = await startServer({
    port: 0,
    sync: {
      timers: options.timers,
      unloadGraceMs: GRACE_MS,
      pingIntervalMs: PING_MS,
      ...(options.loadNote ? { loadNote: options.loadNote } : {}),
    },
  });
  return server;
}

describe("room lifecycle", () => {
  it("two simultaneous joins share one load: the note is never in memory twice", async () => {
    const load = deferred<Uint8Array | null>();
    const loadNote = vi.fn(() => load.promise);
    const s = await start({ timers: new ManualTimers(), loadNote });
    const noteId = createNoteId();

    const a = connectClient(s.port, noteId);
    const b = connectClient(s.port, noteId);
    await eventually(() => {
      expect(loadNote).toHaveBeenCalled();
    });
    load.resolve(stateWithText("from storage"));
    await Promise.all([a.synced(), b.synced()]);

    expect(loadNote).toHaveBeenCalledTimes(1);
    a.text.insert(0, "A: ");
    await eventually(() => {
      expect(b.text.toJSON()).toBe("A: from storage");
    });
  });

  it("messages that arrive while the note is loading are applied after the load", async () => {
    const load = deferred<Uint8Array | null>();
    const s = await start({ timers: new ManualTimers(), loadNote: () => load.promise });
    const noteId = createNoteId();

    const a = connectClient(s.port, noteId);
    a.text.insert(0, "offline edit. "); // sent as soon as the socket opens
    await eventually(() => {
      expect(a.provider.wsconnected).toBe(true);
    });
    load.resolve(stateWithText("from storage"));

    await eventually(() => {
      const room = s.sync.rooms.get(noteId);
      expect(room?.doc.getText("t").toJSON()).toContain("offline edit.");
      expect(room?.doc.getText("t").toJSON()).toContain("from storage");
      expect(a.text.toJSON()).toContain("from storage");
    });
  });

  it("an empty room stays loaded for a grace period, and a join during it cancels the unload", async () => {
    const timers = new ManualTimers();
    const loadNote = vi.fn(() => Promise.resolve(null));
    const s = await start({ timers, loadNote });
    const noteId = createNoteId();

    const a = connectClient(s.port, noteId);
    await a.synced();
    const room = s.sync.rooms.get(noteId);
    a.destroy();
    await eventually(() => {
      expect(room?.isEmpty).toBe(true);
    });

    timers.advance(GRACE_MS - 1);
    const b = connectClient(s.port, noteId); // a reload, say
    await b.synced();
    timers.advance(GRACE_MS * 2);

    expect(s.sync.rooms.get(noteId)).toBe(room); // same room, never unloaded
    expect(loadNote).toHaveBeenCalledTimes(1);
  });

  it("an empty room is unloaded once the grace period passes", async () => {
    const timers = new ManualTimers();
    const s = await start({ timers });
    const noteId = createNoteId();

    const a = connectClient(s.port, noteId);
    await a.synced();
    a.destroy();
    await eventually(() => {
      expect(s.sync.rooms.get(noteId)?.isEmpty).toBe(true);
    });

    timers.advance(GRACE_MS);
    expect(s.sync.rooms.has(noteId)).toBe(false);
  });

  it("a socket that stops answering pings is terminated and its cursor removed", async () => {
    const timers = new ManualTimers();
    const s = await start({ timers });
    const noteId = createNoteId();
    const observer = connectClient(s.port, noteId);
    await observer.synced();

    // A raw client that never answers pings, like a laptop that went to sleep.
    const query = `t=${defaultTokenFor(noteId)}&pv=1`;
    const dead = new RawWebSocket(`ws://127.0.0.1:${String(s.port)}/sync/${noteId}?${query}`, {
      autoPong: false,
    });
    await new Promise((resolve) => dead.once("open", resolve));
    const ghostId = 424242;
    dead.send(awarenessMessage(ghostId, { user: { name: "Sleepy" } }));
    await eventually(() => {
      expect(observer.provider.awareness.getStates().has(ghostId)).toBe(true);
    });

    const closed = new Promise((resolve) => dead.once("close", resolve));
    timers.advance(PING_MS); // everyone is pinged; the dead socket will not answer

    // The healthy observer shows a sign of life. Wait until the server has relayed it (the
    // dead socket still receives broadcasts), so the server has seen it before time moves.
    const relayed = new Promise((resolve) => dead.once("message", resolve));
    observer.provider.awareness.setLocalStateField("user", { name: "Awake" });
    await relayed;

    timers.advance(PING_MS); // still no answer from the dead socket: terminated
    await closed;

    await eventually(() => {
      expect(observer.provider.awareness.getStates().has(ghostId)).toBe(false);
    });
    // The healthy client answered its pings and is still connected.
    expect(observer.provider.wsconnected).toBe(true);
  });
});

/** An awareness message as a client would send it, for a made-up client ID. */
function awarenessMessage(clientId: number, state: Record<string, unknown>): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = clientId;
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(state);
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, [clientId]),
  );
  awareness.destroy();
  return encoding.toUint8Array(encoder);
}
