import type { Role } from "@driftnote/shared";
import { createHash } from "node:crypto";
import * as Y from "yjs";
import type { Db } from "./database";

/** SHA-256 of a token: what the database stores instead of the token (ADR 006, ADR 011). */
export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export interface TokenGrant {
  readonly tokenId: number;
  readonly role: Role;
}

/** Token and tombstone lookups for connect-time auth (ARCHITECTURE.md, section 6.1). */
export class TokensStore {
  private readonly findGrant;
  private readonly noteRow;
  private readonly tombstone;
  private readonly insertNote;
  private readonly insertToken;
  readonly claimOwner: (noteId: string, token: string, now?: number) => TokenGrant;

  constructor(db: Db) {
    this.findGrant = db.prepare<[string, Buffer], { token_id: number; role: Role }>(
      "SELECT token_id, role FROM tokens WHERE note_id = ? AND token_hash = ? AND revoked_at IS NULL",
    );
    this.noteRow = db.prepare<[string], { n: number }>(
      "SELECT count(*) AS n FROM notes WHERE note_id = ?",
    );
    this.tombstone = db.prepare<[string], { n: number }>(
      "SELECT count(*) AS n FROM tombstones WHERE note_id = ?",
    );
    this.insertNote = db.prepare<[string, Buffer, number, number]>(
      "INSERT INTO notes (note_id, state, schema_version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)",
    );
    this.insertToken = db.prepare<[string, Buffer, number]>(
      "INSERT INTO tokens (note_id, token_hash, role, created_at) VALUES (?, ?, 'owner', ?)",
    );
    // The note row comes first: tokens reference notes. One transaction, so a claim is
    // all-or-nothing.
    const emptyState = Buffer.from(Y.encodeStateAsUpdate(new Y.Doc()));
    this.claimOwner = db.transaction((noteId: string, token: string, now: number = Date.now()) => {
      this.insertNote.run(noteId, emptyState, now, now);
      const result = this.insertToken.run(noteId, hashToken(token), now);
      return { tokenId: Number(result.lastInsertRowid), role: "owner" as const };
    });
  }

  /** The active (not revoked) grant for this note and token, if any. */
  find(noteId: string, token: string): TokenGrant | null {
    const row = this.findGrant.get(noteId, hashToken(token));
    return row ? { tokenId: row.token_id, role: row.role } : null;
  }

  noteExists(noteId: string): boolean {
    return (this.noteRow.get(noteId)?.n ?? 0) > 0;
  }

  isDeleted(noteId: string): boolean {
    return (this.tombstone.get(noteId)?.n ?? 0) > 0;
  }
}
