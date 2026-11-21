import { createNoteId } from "@driftnote/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, type RunningServer } from "../src/server";
import { connectClient, destroyAllClients } from "./support/clients";

let server: RunningServer;
let noteId: string;

beforeEach(async () => {
  server = await startServer({ port: 0 });
  noteId = createNoteId();
});

afterEach(async () => {
  destroyAllClients();
  await server.close();
});

const eventually = (assertion: () => void): Promise<void> =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 });

describe("rooms and sync relay", () => {
  it("two clients editing the same note converge", async () => {
    const a = connectClient(server.port, noteId);
    const b = connectClient(server.port, noteId);
    await Promise.all([a.synced(), b.synced()]);

    a.text.insert(0, "Hello");
    b.text.insert(0, "World ");

    await eventually(() => {
      expect(a.text.toJSON()).toBe(b.text.toJSON());
      expect(a.text.toJSON()).toContain("Hello");
      expect(a.text.toJSON()).toContain("World");
    });
  });

  it("a client that joins late receives the whole note", async () => {
    const a = connectClient(server.port, noteId);
    await a.synced();
    a.text.insert(0, "Written before anyone else joined");

    const late = connectClient(server.port, noteId);
    await late.synced();

    await eventually(() => {
      expect(late.text.toJSON()).toBe("Written before anyone else joined");
    });
  });

  it("notes are isolated: edits in one room never reach another", async () => {
    const a = connectClient(server.port, noteId);
    const other = connectClient(server.port, createNoteId());
    await Promise.all([a.synced(), other.synced()]);

    a.text.insert(0, "Only for this note");
    const b = connectClient(server.port, noteId);
    await b.synced();
    await eventually(() => {
      expect(b.text.toJSON()).toBe("Only for this note");
    });
    expect(other.text.toJSON()).toBe("");
  });

  it("after a disconnect, edits made on both sides catch up in both directions", async () => {
    const a = connectClient(server.port, noteId);
    const b = connectClient(server.port, noteId);
    await Promise.all([a.synced(), b.synced()]);
    a.text.insert(0, "start.");
    await eventually(() => {
      expect(b.text.toJSON()).toBe("start.");
    });

    b.provider.disconnect();
    a.text.insert(a.text.length, " A while B was away.");
    b.text.insert(b.text.length, " B offline.");
    expect(a.text.toJSON()).not.toContain("B offline");

    b.provider.connect();
    await eventually(() => {
      for (const client of [a, b]) {
        expect(client.text.toJSON()).toContain("A while B was away.");
        expect(client.text.toJSON()).toContain("B offline.");
      }
      expect(a.text.toJSON()).toBe(b.text.toJSON());
    });
  });

  it("presence appears for others and is removed when a client's connection closes", async () => {
    const a = connectClient(server.port, noteId);
    const b = connectClient(server.port, noteId);
    await Promise.all([a.synced(), b.synced()]);

    a.provider.awareness.setLocalStateField("user", { name: "Ann", color: "#0f6e7a" });
    await eventually(() => {
      const seen = b.provider.awareness.getStates().get(a.doc.clientID) as
        { user?: { name: string } } | undefined;
      expect(seen?.user?.name).toBe("Ann");
    });

    // Close A's socket without A saying goodbye (like a closed laptop lid): the server
    // must remove A's presence for everyone else, or B is left with a ghost cursor.
    a.provider.shouldConnect = false;
    a.provider.ws?.close();
    await eventually(() => {
      expect(b.provider.awareness.getStates().has(a.doc.clientID)).toBe(false);
    });
  });

  it("refuses WebSocket connections to paths that are not a valid note", async () => {
    const result = await new Promise<string>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${String(server.port)}/sync/not-a-note-id?pv=1`);
      ws.onopen = () => resolve("open");
      ws.onerror = () => resolve("refused");
    });
    expect(result).toBe("refused");
  });
});
