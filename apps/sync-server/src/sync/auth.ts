import {
  CLOSE_INVALID_TOKEN,
  CLOSE_NOTE_DELETED,
  CLOSE_PROTOCOL_TOO_OLD,
  isWellFormedToken,
  PROTOCOL_VERSION,
} from "@driftnote/shared";
import type { TokenGrant, TokensStore } from "../db/tokensStore";

export type AuthResult = { ok: true; grant: TokenGrant } | { ok: false; closeCode: number };

/** Protocol versions this server speaks. */
const SUPPORTED_PROTOCOL_VERSIONS = new Set([PROTOCOL_VERSION]);

/**
 * Connect-time checks, in order (ARCHITECTURE.md, section 6.1): protocol version,
 * tombstone, token. The first connection to an unknown note claims it as owner. Never
 * logs: the token travels in the query string and must not end up in logs.
 */
export function authorize(
  tokens: TokensStore,
  noteId: string,
  params: URLSearchParams,
): AuthResult {
  if (!SUPPORTED_PROTOCOL_VERSIONS.has(Number(params.get("pv")))) {
    return { ok: false, closeCode: CLOSE_PROTOCOL_TOO_OLD };
  }
  if (tokens.isDeleted(noteId)) return { ok: false, closeCode: CLOSE_NOTE_DELETED };

  const token = params.get("t") ?? "";
  const grant = token ? tokens.find(noteId, token) : null;
  if (grant) return { ok: true, grant };
  // Unknown note: this is its creator's first sync. Only a properly random token may
  // claim it, so a careless client cannot "protect" a note with a guessable token.
  if (!tokens.noteExists(noteId) && isWellFormedToken(token)) {
    try {
      return { ok: true, grant: tokens.claimOwner(noteId, token) };
    } catch {
      // The token already belongs to another note (hashes are unique). Each note has its
      // own owner token, so this is a misbehaving client: refuse, do not crash.
      return { ok: false, closeCode: CLOSE_INVALID_TOKEN };
    }
  }
  return { ok: false, closeCode: CLOSE_INVALID_TOKEN };
}
