import { NOTE_CONTENT_KEY, NOTE_META_KEY, NOTE_SCHEMA_VERSION } from "@driftnote/shared";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

/** Whether this browser's IndexedDB holds every change made to the note so far. */
export type LocalState = "loading" | "saving" | "saved";

/** Values stored in a note's `meta` map (ADR 002, ADR 012). */
export interface NoteMeta {
  title: string;
  createdAt: number;
  /** Last local edit, refreshed at most every `UPDATED_AT_RESOLUTION_MS`. */
  updatedAt: number;
  schemaVersion: number;
}

/**
 * `updatedAt` is only for "most recent first" ordering, so it is refreshed at most this
 * often: rewriting a map key on every keystroke would add Yjs metadata for no benefit.
 */
export const UPDATED_AT_RESOLUTION_MS = 10_000;

/** Transaction origin for our own `updatedAt` refresh, so it does not trigger itself. */
const UPDATED_AT_ORIGIN = Symbol("updatedAt");

/**
 * One open note: its Y.Doc, persisted to IndexedDB by `y-indexeddb` (ADR 004).
 * `y-indexeddb` writes each update in its own IndexedDB transaction but does not report
 * when that write finished, so `localState` is tracked here (see `trackSave`).
 */
export class OpenNote {
  readonly doc = new Y.Doc();
  readonly content: Y.XmlFragment;
  readonly meta: Y.Map<NoteMeta[keyof NoteMeta]>;
  readonly loaded: Promise<void>;

  private readonly persistence: IndexeddbPersistence;
  private state: LocalState = "loading";
  private pendingSaves = 0;
  private changedBeforeLoad = false;
  private readonly listeners = new Set<() => void>();

  constructor(readonly noteId: string) {
    this.content = this.doc.getXmlFragment(NOTE_CONTENT_KEY);
    this.meta = this.doc.getMap(NOTE_META_KEY);
    this.persistence = new IndexeddbPersistence(dbName(noteId), this.doc);
    // Registered after y-indexeddb's own listener, so its write transaction already exists.
    this.doc.on("update", this.onUpdate);
    this.loaded = this.persistence.whenSynced.then(() => {
      // Changes made before the database opened are written by y-indexeddb on open.
      if (this.changedBeforeLoad) this.trackSave();
      else this.setState("saved");
    });
  }

  get localState(): LocalState {
    return this.state;
  }

  /**
   * False when the note uses a newer document schema than this app understands
   * (ADR 012). Such a note is read-only: editing it could damage content we cannot see.
   */
  get isEditable(): boolean {
    return (readMeta(this)?.schemaVersion ?? NOTE_SCHEMA_VERSION) <= NOTE_SCHEMA_VERSION;
  }

  /**
   * A disposable copy of the note's document, for showing a note this app may not edit.
   * The editor deletes block types it does not know from whatever document it is bound to
   * (spike S20), so a gated note's editor gets a copy. Pair with `forwardUpdatesTo`.
   */
  createReadOnlyCopy(): Y.Doc {
    const copy = new Y.Doc();
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(this.doc));
    return copy;
  }

  /**
   * Keeps `copy` up to date with this note, one way: nothing flows back. Catches up first,
   * in case changes arrived since the copy was made. Returns an unsubscribe function.
   */
  forwardUpdatesTo(copy: Y.Doc): () => void {
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(this.doc, Y.encodeStateVector(copy)));
    const forward = (update: Uint8Array): void => Y.applyUpdate(copy, update);
    this.doc.on("update", forward);
    return () => this.doc.off("update", forward);
  }

  /** For React's `useSyncExternalStore`. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Resolves once every change made so far is in IndexedDB. */
  whenSaved(): Promise<void> {
    if (this.state === "saved") return Promise.resolve();
    return new Promise((resolve) => {
      const unsubscribe = this.subscribe(() => {
        if (this.state === "saved") {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  /** Deletes this note's IndexedDB database. The note must not be used afterwards. */
  async deleteLocal(): Promise<void> {
    this.doc.off("update", this.onUpdate);
    await this.persistence.clearData();
    this.doc.destroy();
  }

  async close(): Promise<void> {
    this.doc.off("update", this.onUpdate);
    await this.persistence.destroy();
    this.doc.destroy();
  }

  private readonly onUpdate = (_update: Uint8Array, origin: unknown): void => {
    if (origin === this.persistence) return; // loaded from IndexedDB, nothing new to save
    this.trackSave();
    if (origin !== UPDATED_AT_ORIGIN) queueMicrotask(this.refreshUpdatedAt);
  };

  private readonly refreshUpdatedAt = (): void => {
    const meta = readMeta(this);
    const now = Date.now();
    if (!meta || !this.isEditable || now - meta.updatedAt < UPDATED_AT_RESOLUTION_MS) return;
    this.doc.transact(() => this.meta.set("updatedAt", now), UPDATED_AT_ORIGIN);
  };

  /**
   * IndexedDB runs transactions on the same store in the order they were created, so a
   * read-only transaction created now completes only after y-indexeddb's write for this
   * update has committed.
   */
  private trackSave(): void {
    const db = this.persistence.db;
    if (!db || !this.persistence.synced) {
      this.changedBeforeLoad = true; // settled by the `loaded` handler
      this.setState("saving");
      return;
    }
    this.pendingSaves += 1;
    this.setState("saving");
    const barrier = db.transaction("updates", "readonly");
    const settle = (): void => {
      this.pendingSaves -= 1;
      if (this.pendingSaves === 0) this.setState("saved");
    };
    barrier.oncomplete = settle;
    barrier.onerror = settle;
  }

  private setState(next: LocalState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}

const NOTE_DB_PREFIX = "driftnote-note-";

/** IndexedDB database name for a note's updates. */
export function dbName(noteId: string): string {
  return `${NOTE_DB_PREFIX}${noteId}`;
}

/** IDs of all notes stored in this browser, found from their database names. */
export async function listLocalNoteIds(): Promise<string[]> {
  const databases = await indexedDB.databases();
  return databases
    .map((d) => d.name ?? "")
    .filter((name) => name.startsWith(NOTE_DB_PREFIX))
    .map((name) => name.slice(NOTE_DB_PREFIX.length));
}

export async function noteExistsLocally(noteId: string): Promise<boolean> {
  return (await listLocalNoteIds()).includes(noteId);
}

/** The note's metadata, or `null` if it has none (not created yet, or not a note). */
export function readMeta(note: OpenNote): NoteMeta | null {
  const { meta } = note;
  const createdAt = meta.get("createdAt");
  if (typeof createdAt !== "number") return null;
  const title = meta.get("title");
  const updatedAt = meta.get("updatedAt");
  const schemaVersion = meta.get("schemaVersion");
  return {
    title: typeof title === "string" ? title : "",
    createdAt,
    updatedAt: typeof updatedAt === "number" ? updatedAt : createdAt,
    schemaVersion: typeof schemaVersion === "number" ? schemaVersion : 1,
  };
}
