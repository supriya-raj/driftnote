import { ApiError, fetchRole } from "../api/client";
import { getAccess, putAccess } from "./access";

export type LinkResult = "none" | "stored" | "invalid" | "offline";

/**
 * Handles a share link (`/n/<id>#t=<token>`, ADR 006): asks the server what the token may
 * do, stores it as this browser's access to the note, and removes the token from the
 * address bar so it does not linger in history or screenshots. The fragment is never sent
 * to any server by the browser.
 */
export async function acceptLinkFromUrl(noteId: string): Promise<LinkResult> {
  const token = new URLSearchParams(location.hash.slice(1)).get("t");
  if (!token) return "none";
  history.replaceState(history.state, "", location.pathname + location.search);

  let role;
  try {
    role = await fetchRole(noteId, token);
  } catch (err) {
    return err instanceof ApiError && err.status === 0 ? "offline" : "invalid";
  }
  const existing = await getAccess(noteId);
  // Never trade an owner's token for a weaker link to the same note.
  if (existing?.role !== "owner") {
    await putAccess({ noteId, token, role, unsynced: false, syncedAt: existing?.syncedAt ?? null });
  }
  return "stored";
}
