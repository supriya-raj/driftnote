import { createNoteId, MESSAGE_AWARENESS, PROTOCOL_VERSION } from "@driftnote/shared";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket as RawWebSocket } from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { startServer, type RunningServer } from "../src/server";
import { connectClient, defaultTokenFor, destroyAllClients } from "./support/clients";

let server: RunningServer;
const sockets: RawWebSocket[] = [];

beforeEach(async () => {
  server = await startServer({ port: 0 });
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  destroyAllClients();
  await server.close();
});

const eventually = (assertion: () => void): Promise<void> =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 });

/** An awareness message claiming `clientId` has `state`, with a high clock so it would win. */
function awarenessFor(clientId: number, state: Record<string, unknown>, clock = 1000): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = clientId;
  const awareness = new awarenessProtocol.Awareness(doc);
  for (let i = 0; i < clock; i++) awareness.setLocalState({ ...state, i });
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, [clientId]),
  );
  awareness.destroy();
  return encoding.toUint8Array(encoder);
}

type UserState = { user?: { name?: string } } | undefined;

describe("presence", () => {
  it("one connection cannot overwrite another person's presence", async () => {
    const noteId = createNoteId();
    const alice = connectClient(server.port, noteId);
    const observer = connectClient(server.port, noteId);
    await Promise.all([alice.synced(), observer.synced()]);
    alice.provider.awareness.setLocalStateField("user", { name: "Alice" });
    await eventually(() => {
      expect(
        (observer.provider.awareness.getStates().get(alice.doc.clientID) as UserState)?.user?.name,
      ).toBe("Alice");
    });

    const query = new URLSearchParams({ t: defaultTokenFor(noteId), pv: String(PROTOCOL_VERSION) });
    const mallory = new RawWebSocket(
      `ws://127.0.0.1:${String(server.port)}/sync/${noteId}?${query.toString()}`,
    );
    sockets.push(mallory);
    await new Promise((resolve) => mallory.once("open", resolve));
    mallory.send(awarenessFor(alice.doc.clientID, { user: { name: "Not Alice" } }));
    // Barrier: Mallory's own (allowed) presence arrives after the spoofing attempt.
    mallory.send(awarenessFor(777, { user: { name: "Mallory" } }));
    await eventually(() => {
      expect(observer.provider.awareness.getStates().has(777)).toBe(true);
    });

    expect(
      (observer.provider.awareness.getStates().get(alice.doc.clientID) as UserState)?.user?.name,
    ).toBe("Alice");
    expect(
      (server.sync.rooms.get(noteId)?.awareness.getStates().get(alice.doc.clientID) as UserState)
        ?.user?.name,
    ).toBe("Alice");
  });

  it("a connection can keep updating and finally remove its own presence", async () => {
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    const b = connectClient(server.port, noteId);
    await Promise.all([a.synced(), b.synced()]);

    a.provider.awareness.setLocalStateField("user", { name: "First" });
    a.provider.awareness.setLocalStateField("user", { name: "Second" });
    await eventually(() => {
      expect((b.provider.awareness.getStates().get(a.doc.clientID) as UserState)?.user?.name).toBe(
        "Second",
      );
    });
    a.provider.awareness.setLocalState(null);
    await eventually(() => {
      expect(b.provider.awareness.getStates().has(a.doc.clientID)).toBe(false);
    });
  });

  it("a joining client gets the content before anyone's cursor", async () => {
    const noteId = createNoteId();
    const alice = connectClient(server.port, noteId);
    await alice.synced();
    alice.text.insert(0, "content first");
    alice.provider.awareness.setLocalStateField("user", { name: "Alice" });
    await eventually(() => {
      expect(server.sync.rooms.get(noteId)?.awareness.getStates().size).toBe(1);
    });

    // A raw client, to see the exact order of messages.
    const query = new URLSearchParams({ t: defaultTokenFor(noteId), pv: String(PROTOCOL_VERSION) });
    const ws = new RawWebSocket(
      `ws://127.0.0.1:${String(server.port)}/sync/${noteId}?${query.toString()}`,
    );
    sockets.push(ws);
    const kinds: string[] = [];
    ws.on("message", (data: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const type = decoding.readVarUint(decoder);
      // Sync subtypes are numbered from 0: step 1, step 2, update.
      const SYNC_KINDS = ["step1", "step2", "update"];
      if (type === MESSAGE_AWARENESS) kinds.push("awareness");
      else if (type === 0) kinds.push(SYNC_KINDS[decoding.readVarUint(decoder)] ?? "?");
      else kinds.push(String(type));
    });
    await new Promise((resolve) => ws.once("open", resolve));
    const step1 = encoding.createEncoder();
    encoding.writeVarUint(step1, 0);
    syncProtocol.writeSyncStep1(step1, new Y.Doc());
    ws.send(encoding.toUint8Array(step1));

    await eventually(() => {
      expect(kinds).toContain("awareness");
    });
    // sync1 = the server's own step 1; sync2 = the content this client was missing.
    expect(kinds).toContain("step1"); // the server's own "here is what I have"
    expect(kinds).toContain("step2"); // the content this client was missing
    expect(kinds.indexOf("step2")).toBeLessThan(kinds.indexOf("awareness"));
  });
});
