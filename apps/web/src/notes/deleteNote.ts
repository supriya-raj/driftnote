import type { OpenNote } from "./noteDoc";
import { removeAccess } from "./access";
import { removeListEntry } from "./noteList";

/**
 * Removes a note from this browser only (its database and list entry). "Delete for
 * everyone" on the server comes in Phase 3 (T43).
 */
export async function deleteNoteLocally(note: OpenNote): Promise<void> {
  await removeListEntry(note.noteId);
  await removeAccess(note.noteId);
  await note.deleteLocal();
}
