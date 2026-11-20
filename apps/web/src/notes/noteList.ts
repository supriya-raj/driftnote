import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { listLocalNoteIds, OpenNote, readMeta } from "./noteDoc";

/**
 * The note list: a cache in IndexedDB so the home page does not have to open every note
 * (ADR 002, ADR 004). Every field is copied from a note's `meta`, so the whole store can
 * be dropped and rebuilt from the notes themselves.
 */
export interface NoteListEntry {
  noteId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface IndexSchema extends DBSchema {
  notes: { key: string; value: NoteListEntry; indexes: { updatedAt: number } };
}

export const INDEX_DB_NAME = "driftnote";
// Bump when the store layout changes: the cache is then dropped and rebuilt (ADR 012).
const INDEX_DB_VERSION = 1;

let indexPromise: Promise<IDBPDatabase<IndexSchema>> | null = null;

function getIndex(): Promise<IDBPDatabase<IndexSchema>> {
  indexPromise ??= openIndex();
  return indexPromise;
}

async function openIndex(): Promise<IDBPDatabase<IndexSchema>> {
  // An object, because TypeScript cannot see the `upgrade` callback changing a plain `let`.
  const status = { needsRebuild: false };
  const db = await openDB<IndexSchema>(INDEX_DB_NAME, INDEX_DB_VERSION, {
    upgrade(db) {
      // New or outdated cache: start empty and rebuild from the notes after opening.
      for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name);
      const notes = db.createObjectStore("notes", { keyPath: "noteId" });
      notes.createIndex("updatedAt", "updatedAt");
      status.needsRebuild = true;
    },
    blocking() {
      // Another tab (or a test hook) wants to delete or upgrade the database.
      db.close();
      indexPromise = null;
    },
  });
  if (status.needsRebuild) await rebuild(db);
  return db;
}

async function rebuild(db: IDBPDatabase<IndexSchema>): Promise<void> {
  const entries: NoteListEntry[] = [];
  for (const noteId of await listLocalNoteIds()) {
    const note = new OpenNote(noteId);
    try {
      await note.loaded;
      const entry = entryFromNote(note);
      if (entry) entries.push(entry);
    } finally {
      await note.close();
    }
  }
  const tx = db.transaction("notes", "readwrite");
  await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done]);
}

function entryFromNote(note: OpenNote): NoteListEntry | null {
  const meta = readMeta(note);
  if (!meta) return null; // not a real note (no metadata written yet)
  return { noteId: note.noteId, ...meta };
}

/** All notes, most recently updated first. */
export async function listNotes(): Promise<NoteListEntry[]> {
  const db = await getIndex();
  const entries = await db.getAllFromIndex("notes", "updatedAt");
  return entries.reverse();
}

export async function saveListEntry(note: OpenNote): Promise<void> {
  const entry = entryFromNote(note);
  if (entry) await (await getIndex()).put("notes", entry);
}

export async function removeListEntry(noteId: string): Promise<void> {
  await (await getIndex()).delete("notes", noteId);
}

/** Keeps the note's list entry in step with its `meta`. Returns an unsubscribe function. */
export function keepListEntryInSync(note: OpenNote): () => void {
  const save = (): void => void saveListEntry(note);
  note.meta.observe(save);
  save();
  return () => {
    note.meta.unobserve(save);
  };
}

/** Test hook: delete the cache database. The next `getIndex()` rebuilds it. */
export async function deleteNoteList(): Promise<void> {
  if (indexPromise) (await indexPromise).close();
  indexPromise = null;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(INDEX_DB_NAME);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("deleteDatabase failed"));
    };
  });
}
