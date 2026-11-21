import { ackCovers, createNoteId } from "@driftnote/shared";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, type RunningServer } from "../src/server";
import { connectClient, destroyAllClients } from "./support/clients";
import { ManualTimers } from "./support/manualTimers";
import { makeTempDir } from "./support/tempDir";

const SAVE_MS = 2000;

let dir: { path: string; cleanup: () => Promise<void> };
let timers: ManualTimers;
let server: RunningServer;

beforeEach(async () => {
  dir = await makeTempDir();
  timers = new ManualTimers();
  server = await startServer({
    port: 0,
    databasePath: join(dir.path, "notes.sqlite"),
    sync: { timers, saveDebounceMs: SAVE_MS },
  });
});

afterEach(async () => {
  destroyAllClients();
  await server.close();
  await dir.cleanup();
});

const eventually = (assertion: () => void): Promise<void> =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 });

function rowExists(noteId: string): boolean {
  return (
    server.db
      .prepare<[string], { n: number }>("SELECT count(*) AS n FROM notes WHERE note_id = ?")
      .get(noteId)?.n === 1
  );
}

describe("save acknowledgement", () => {
  it("arrives only after the change is in the database, and covers the client's change", async () => {
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    await a.synced();
    const acksBefore = a.acks.length;

    a.text.insert(0, "precious words");
    await eventually(() => {
      expect(server.sync.rooms.get(noteId)?.doc.getText("t").toJSON()).toBe("precious words");
    });
    expect(a.acks.length).toBe(acksBefore); // received but not saved: no ack yet
    expect(rowExists(noteId)).toBe(false);

    timers.advance(SAVE_MS);
    await eventually(() => {
      expect(a.acks.length).toBe(acksBefore + 1);
    });
    expect(rowExists(noteId)).toBe(true);
    const latest = a.acks.at(-1);
    expect(latest && ackCovers(a.doc, latest)).toBe(true);
  });

  it("every connection gets the ack, covering everyone's saved changes", async () => {
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    const b = connectClient(server.port, noteId);
    await Promise.all([a.synced(), b.synced()]);

    a.text.insert(0, "A ");
    b.text.insert(0, "B ");
    await eventually(() => {
      expect(a.text.toJSON()).toBe(b.text.toJSON());
      expect(a.text.length).toBe(4);
    });
    timers.advance(SAVE_MS);

    await eventually(() => {
      for (const client of [a, b]) {
        const latest = client.acks.at(-1);
        expect(latest && ackCovers(client.doc, latest)).toBe(true);
      }
    });
  });

  it("a change made after the save is not covered until the next ack", async () => {
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    await a.synced();
    a.text.insert(0, "saved.");
    await eventually(() => {
      expect(server.sync.rooms.get(noteId)?.doc.getText("t").toJSON()).toBe("saved.");
    });
    timers.advance(SAVE_MS);
    await eventually(() => {
      expect(a.acks.length).toBeGreaterThan(0);
    });

    a.text.delete(0, 1); // a delete-only change
    const lastAck = a.acks.at(-1);
    expect(lastAck && ackCovers(a.doc, lastAck)).toBe(false);

    await eventually(() => {
      expect(server.sync.rooms.get(noteId)?.doc.getText("t").toJSON()).toBe("aved.");
    });
    timers.advance(SAVE_MS);
    await eventually(() => {
      const latest = a.acks.at(-1);
      expect(latest && ackCovers(a.doc, latest)).toBe(true);
    });
  });

  it("joining a note that is already saved gets an ack without any new change", async () => {
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    await a.synced();
    a.text.insert(0, "already saved");
    await eventually(() => {
      expect(server.sync.rooms.get(noteId)?.doc.getText("t").toJSON()).toBe("already saved");
    });
    timers.advance(SAVE_MS);

    const b = connectClient(server.port, noteId); // e.g. reopening the note later
    await b.synced();
    await eventually(() => {
      const latest = b.acks.at(-1);
      expect(latest && ackCovers(b.doc, latest)).toBe(true);
    });
  });

  it("sends no ack when saving fails, and acknowledges once a retry succeeds", async () => {
    await server.close();
    let failNext = true;
    const saved: string[] = [];
    server = await startServer({
      port: 0,
      sync: {
        timers,
        saveDebounceMs: SAVE_MS,
        saveNote: (noteId) => {
          if (failNext) {
            failNext = false;
            throw new Error("disk full");
          }
          saved.push(noteId);
        },
      },
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    const b = connectClient(server.port, noteId);
    await Promise.all([a.synced(), b.synced()]);
    const acksBefore = a.acks.length;
    a.text.insert(0, "must not be acknowledged yet");
    await eventually(() => {
      expect(server.sync.rooms.get(noteId)?.doc.getText("t").length).toBeGreaterThan(0);
    });

    timers.advance(SAVE_MS); // save fails
    expect(saved).toEqual([]);
    // Barrier: the server forwards B's edit to A *after* the failed save. Messages from the
    // server to A arrive in order, so once A has it, a wrongly sent ack would have arrived.
    b.text.insert(0, "barrier ");
    await eventually(() => {
      expect(a.text.toJSON()).toContain("barrier");
    });
    expect(a.acks.length).toBe(acksBefore);

    timers.advance(SAVE_MS); // retry succeeds
    expect(saved).toEqual([noteId]);
    await eventually(() => {
      const latest = a.acks.at(-1);
      expect(latest && ackCovers(a.doc, latest)).toBe(true);
    });
    errors.mockRestore();
  });
});
