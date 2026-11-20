import { NOTE_CONTENT_KEY, NOTE_META_KEY } from "@driftnote/shared";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

/** Whether this browser's IndexedDB holds every change made to the note so far. */
export type LocalState = "loading" | "saving" | "saved";

/** Values stored in a note's `meta` map (ADR 002, ADR 012). */
export interface NoteMeta {
  title: string;
  createdAt: number;
  schemaVersion: number;
}

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

  async close(): Promise<void> {
    this.doc.off("update", this.onUpdate);
    await this.persistence.destroy();
    this.doc.destroy();
  }

  private readonly onUpdate = (_update: Uint8Array, origin: unknown): void => {
    if (origin === this.persistence) return; // loaded from IndexedDB, nothing new to save
    this.trackSave();
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

/** IndexedDB database name for a note's updates. */
export function dbName(noteId: string): string {
  return `driftnote-note-${noteId}`;
}
