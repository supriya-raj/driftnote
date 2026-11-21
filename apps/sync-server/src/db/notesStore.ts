import type { Db } from "./database";

/** Reading and writing whole note states (ARCHITECTURE.md, sections 5.2 and 7.3). */
export class NotesStore {
  private readonly selectState;
  private readonly upsertState;

  constructor(db: Db) {
    this.selectState = db.prepare<[string], { state: Buffer }>(
      "SELECT state FROM notes WHERE note_id = ?",
    );
    this.upsertState = db.prepare<[string, Buffer, number, number, number]>(
      `INSERT INTO notes (note_id, state, schema_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (note_id) DO UPDATE SET
         state = excluded.state,
         schema_version = excluded.schema_version,
         updated_at = excluded.updated_at`,
    );
  }

  /** The note's saved state, or null if the server has never stored it. */
  load(noteId: string): Uint8Array | null {
    const row = this.selectState.get(noteId);
    return row ? new Uint8Array(row.state) : null;
  }

  /** Replaces the note's state with `state` (a whole-document update), in one statement. */
  save(noteId: string, state: Uint8Array, schemaVersion: number, now = Date.now()): void {
    // created_at is only used on insert; an existing row keeps its original value.
    this.upsertState.run(noteId, Buffer.from(state), schemaVersion, now, now);
  }
}
