import { createNoteId } from "@driftnote/shared";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { startServer, type RunningServer } from "../src/server";
import { connectClient, destroyAllClients } from "./support/clients";
import { ManualTimers } from "./support/manualTimers";
import { makeTempDir } from "./support/tempDir";

const SAVE_MS = 2000;
const GRACE_MS = 30_000;

let dir: { path: string; cleanup: () => Promise<void> };
let timers: ManualTimers;
const servers: RunningServer[] = [];

beforeEach(async () => {
  dir = await makeTempDir();
  timers = new ManualTimers();
});

afterEach(async () => {
  destroyAllClients();
  for (const s of servers.splice(0)) await s.close();
  await dir.cleanup();
});

async function start(): Promise<RunningServer> {
  const server = await startServer({
    port: 0,
    databasePath: join(dir.path, "notes.sqlite"),
    sync: { timers, saveDebounceMs: SAVE_MS, unloadGraceMs: GRACE_MS },
  });
  servers.push(server);
  return server;
}

async function stop(server: RunningServer): Promise<void> {
  servers.splice(servers.indexOf(server), 1);
  await server.close();
}

/** The note's text as stored in SQLite (decoded from the saved blob), or null. */
function storedText(server: RunningServer, noteId: string): string | null {
  const row = server.db
    .prepare<[string], { state: Buffer }>("SELECT state FROM notes WHERE note_id = ?")
    .get(noteId);
  if (!row) return null;
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(row.state));
  return doc.getText("t").toJSON();
}

const eventually = (assertion: () => void): Promise<void> =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 });

/** Waits until the server's copy of the note contains `text` (the edit has arrived). */
async function serverHas(server: RunningServer, noteId: string, text: string): Promise<void> {
  await eventually(() => {
    expect(server.sync.rooms.get(noteId)?.doc.getText("t").toJSON()).toContain(text);
  });
}

describe("persistence", () => {
  it("saves within the debounce window after a change, not before", async () => {
    const server = await start();
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    await a.synced();

    a.text.insert(0, "remember this");
    await serverHas(server, noteId, "remember this");
    expect(storedText(server, noteId)).toBe(""); // row created empty by the owner claim

    timers.advance(SAVE_MS);
    expect(storedText(server, noteId)).toBe("remember this");
  });

  it("continuous typing still saves: later edits do not postpone the save", async () => {
    const server = await start();
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    await a.synced();

    for (const word of ["one ", "two ", "three "]) {
      a.text.insert(a.text.length, word);
      await serverHas(server, noteId, word);
      timers.advance(SAVE_MS / 2);
    }
    expect(storedText(server, noteId)).toMatch(/^one two /);
  });

  it("an edit after a save is saved by the next save", async () => {
    const server = await start();
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    await a.synced();

    a.text.insert(0, "first.");
    await serverHas(server, noteId, "first.");
    timers.advance(SAVE_MS);
    a.text.insert(a.text.length, " second.");
    await serverHas(server, noteId, "second.");
    timers.advance(SAVE_MS);

    expect(storedText(server, noteId)).toBe("first. second.");
  });

  it("the saved blob contains every client's changes", async () => {
    const server = await start();
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    const b = connectClient(server.port, noteId);
    await Promise.all([a.synced(), b.synced()]);

    a.text.insert(0, "from A. ");
    b.text.insert(0, "from B. ");
    await serverHas(server, noteId, "from A.");
    await serverHas(server, noteId, "from B.");
    timers.advance(SAVE_MS);

    const stored = storedText(server, noteId);
    expect(stored).toContain("from A.");
    expect(stored).toContain("from B.");
    expect(stored).toBe(server.sync.rooms.get(noteId)?.doc.getText("t").toJSON());
  });

  it("a room unloaded after everyone leaves saves first", async () => {
    const server = await start();
    const noteId = createNoteId();
    const a = connectClient(server.port, noteId);
    await a.synced();
    a.text.insert(0, "saved on unload");
    await serverHas(server, noteId, "saved on unload");
    a.destroy();
    await eventually(() => {
      expect(server.sync.rooms.get(noteId)?.isEmpty).toBe(true);
    });

    timers.advance(GRACE_MS); // unload (the debounce timer is also due by now)
    expect(server.sync.rooms.has(noteId)).toBe(false);
    expect(storedText(server, noteId)).toBe("saved on unload");
  });

  it("after a server restart, a client receives the saved note", async () => {
    const first = await start();
    const noteId = createNoteId();
    const a = connectClient(first.port, noteId);
    await a.synced();
    a.text.insert(0, "survives a restart");
    await serverHas(first, noteId, "survives a restart");
    a.destroy();
    await stop(first); // shutting down saves unsaved rooms

    const second = await start();
    const b = connectClient(second.port, noteId);
    await b.synced();
    expect(b.text.toJSON()).toBe("survives a restart");
  });
});
