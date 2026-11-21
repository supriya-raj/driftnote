import { CLOSE_INVALID_TOKEN, isNoteId, type Role } from "@driftnote/shared";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { TokensStore } from "../db/tokensStore";
import type { SyncEndpoint } from "../sync/syncEndpoint";
import { bearerToken, readJson, sendJson, sendStatus } from "./http";

const TOKENS_PATH = /^\/api\/notes\/([^/]+)\/tokens(?:\/(\d+))?$/;

/**
 * Share-link management (ARCHITECTURE.md, section 6.2), owner only:
 *   POST   /api/notes/:id/tokens            { role: "edit" | "view" } → 201, token shown once
 *   GET    /api/notes/:id/tokens            → 200 list (never tokens)
 *   DELETE /api/notes/:id/tokens/:tokenId   → 204, live users disconnected (4401)
 * Returns false if the path is not a tokens path.
 */
export async function handleTokensApi(
  deps: { tokens: TokensStore; sync: SyncEndpoint },
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const match = TOKENS_PATH.exec(pathname);
  if (!match) return false;
  const noteId = match[1] ?? "";
  const tokenId = match[2] === undefined ? null : Number(match[2]);

  const role = resolveRole(deps.tokens, noteId, bearerToken(req));
  if (typeof role === "number") {
    sendStatus(res, role);
    return true;
  }
  if (role !== "owner") {
    sendStatus(res, 403);
    return true;
  }

  if (tokenId === null && req.method === "GET") {
    sendJson(res, 200, deps.tokens.listLinksOf(noteId));
  } else if (tokenId === null && req.method === "POST") {
    const body = await readJson(req);
    const wanted = (body as { role?: unknown } | null)?.role;
    if (wanted !== "edit" && wanted !== "view") {
      sendStatus(res, 400); // owners are never minted through the API
    } else {
      sendJson(res, 201, deps.tokens.createLink(noteId, wanted));
    }
  } else if (tokenId !== null && req.method === "DELETE") {
    if (deps.tokens.revoke(noteId, tokenId)) {
      deps.sync.disconnectToken(noteId, tokenId, CLOSE_INVALID_TOKEN);
      sendStatus(res, 204);
    } else {
      sendStatus(res, 404);
    }
  } else {
    sendStatus(res, 405);
  }
  return true;
}

/**
 * Resolves the caller's role like the WebSocket handshake: 410 deleted note, 404 unknown
 * note, 401 missing/unknown/revoked token. Returns the role or the HTTP status.
 */
function resolveRole(tokens: TokensStore, noteId: string, token: string): Role | number {
  if (!isNoteId(noteId)) return 404;
  if (tokens.isDeleted(noteId)) return 410;
  if (!tokens.noteExists(noteId)) return 404;
  const grant = token ? tokens.find(noteId, token) : null;
  return grant ? grant.role : 401;
}
