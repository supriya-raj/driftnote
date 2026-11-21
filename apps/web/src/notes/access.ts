import { createToken, type Role } from "@driftnote/shared";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { notifyNoteChange } from "./changes";

/**
 * This browser's access to each note: its token and role, and whether the server has
 * acknowledged every local change. Unlike the note list, none of this can be recomputed
 * from the notes, so it lives in its own database that is never dropped or rebuilt.
 */
export interface NoteAccess {
  noteId: string;
  token: string;
  role: Role;
  /** Local changes the server has not acknowledged yet ("not backed up yet"). */
  unsynced: boolean;
  /** When the server last acknowledged everything (ms), or null if never. */
  syncedAt: number | null;
}

interface AccessSchema extends DBSchema {
  access: { key: string; value: NoteAccess };
}

let dbPromise: Promise<IDBPDatabase<AccessSchema>> | null = null;

function db(): Promise<IDBPDatabase<AccessSchema>> {
  dbPromise ??= openDB<AccessSchema>("driftnote-access", 1, {
    upgrade(database) {
      database.createObjectStore("access", { keyPath: "noteId" });
    },
  });
  return dbPromise;
}

export async function getAccess(noteId: string): Promise<NoteAccess | undefined> {
  return (await db()).get("access", noteId);
}

export async function getAllAccess(): Promise<Map<string, NoteAccess>> {
  const all = await (await db()).getAll("access");
  return new Map(all.map((a) => [a.noteId, a]));
}

export async function putAccess(access: NoteAccess): Promise<void> {
  await (await db()).put("access", access);
  notifyNoteChange();
}

export async function removeAccess(noteId: string): Promise<void> {
  await (await db()).delete("access", noteId);
  notifyNoteChange();
}

/** Records whether the note has unacknowledged changes; writes only when it changes. */
export async function setUnsynced(noteId: string, unsynced: boolean): Promise<void> {
  const current = await getAccess(noteId);
  if (!current || current.unsynced === unsynced) return;
  await putAccess({ ...current, unsynced, syncedAt: unsynced ? current.syncedAt : Date.now() });
}

/**
 * This browser's access to a note it has locally, creating an owner token if there is
 * none: the note was created here (or before syncing existed), and its first sync claims
 * it on the server.
 */
export async function ensureAccess(noteId: string): Promise<NoteAccess> {
  const existing = await getAccess(noteId);
  if (existing) return existing;
  const access: NoteAccess = {
    noteId,
    token: createToken(),
    role: "owner",
    unsynced: true,
    syncedAt: null,
  };
  await putAccess(access);
  return access;
}
