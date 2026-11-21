import { createToken, type Role } from "@driftnote/shared";
import { createHash } from "node:crypto";
import * as Y from "yjs";
import type { Db } from "./database";

/** SHA-256 of a token: what the database stores instead of the token (ADR 006, ADR 011). */
export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** A share link as listed to its owner: never the token itself. */
export interface LinkInfo {
  readonly tokenId: number;
  readonly role: "edit" | "view";
  readonly createdAt: number;
  readonly revokedAt: number | null;
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
  private readonly insertLink;
  private readonly listLinks;
  private readonly revokeLink;
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
    this.insertLink = db.prepare<[string, Buffer, string, number]>(
      "INSERT INTO tokens (note_id, token_hash, role, created_at) VALUES (?, ?, ?, ?)",
    );
    this.listLinks = db.prepare<
      [string],
      { token_id: number; role: "edit" | "view"; created_at: number; revoked_at: number | null }
    >(
      "SELECT token_id, role, created_at, revoked_at FROM tokens WHERE note_id = ? AND role != 'owner' ORDER BY token_id",
    );
    // Only links (not the owner's own token) of this note, and only once.
    this.revokeLink = db.prepare<[number, string, number]>(
      "UPDATE tokens SET revoked_at = ? WHERE note_id = ? AND token_id = ? AND role != 'owner' AND revoked_at IS NULL",
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

  /** Creates a share link; the token is returned here once and only its hash is kept. */
  createLink(
    noteId: string,
    role: "edit" | "view",
    now = Date.now(),
  ): LinkInfo & { readonly token: string } {
    const token = createToken();
    const result = this.insertLink.run(noteId, hashToken(token), role, now);
    return {
      tokenId: Number(result.lastInsertRowid),
      token,
      role,
      createdAt: now,
      revokedAt: null,
    };
  }

  listLinksOf(noteId: string): LinkInfo[] {
    return this.listLinks.all(noteId).map((r) => ({
      tokenId: r.token_id,
      role: r.role,
      createdAt: r.created_at,
      revokedAt: r.revoked_at,
    }));
  }

  /** True if a link of this note was revoked now. */
  revoke(noteId: string, tokenId: number, now = Date.now()): boolean {
    return this.revokeLink.run(now, noteId, tokenId).changes === 1;
  }

  noteExists(noteId: string): boolean {
    return (this.noteRow.get(noteId)?.n ?? 0) > 0;
  }

  isDeleted(noteId: string): boolean {
    return (this.tombstone.get(noteId)?.n ?? 0) > 0;
  }
}
