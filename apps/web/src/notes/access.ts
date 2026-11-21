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

/**
 * A share link this browser created (owner only). The server shows a link's token once,
 * so the owner keeps it here to copy it again later (ARCHITECTURE.md, section 5.3).
 */
export interface ShareLink {
  tokenId: number;
  noteId: string;
  role: "edit" | "view";
  token: string;
  createdAt: number;
}

interface AccessSchema extends DBSchema {
  access: { key: string; value: NoteAccess };
  links: { key: number; value: ShareLink; indexes: { noteId: string } };
}

let dbPromise: Promise<IDBPDatabase<AccessSchema>> | null = null;

function db(): Promise<IDBPDatabase<AccessSchema>> {
  // Forward-only upgrades: this database is never dropped (ADR 012).
  dbPromise ??= openDB<AccessSchema>("driftnote-access", 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) database.createObjectStore("access", { keyPath: "noteId" });
      if (oldVersion < 2) {
        const links = database.createObjectStore("links", { keyPath: "tokenId" });
        links.createIndex("noteId", "noteId");
      }
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
  const database = await db();
  await database.delete("access", noteId);
  for (const link of await database.getAllFromIndex("links", "noteId", noteId)) {
    await database.delete("links", link.tokenId);
  }
  notifyNoteChange();
}

export async function saveShareLink(link: ShareLink): Promise<void> {
  await (await db()).put("links", link);
}

/** Links this browser created for the note, keyed by token ID. */
export async function shareLinksOf(noteId: string): Promise<Map<number, ShareLink>> {
  const links = await (await db()).getAllFromIndex("links", "noteId", noteId);
  return new Map(links.map((l) => [l.tokenId, l]));
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
