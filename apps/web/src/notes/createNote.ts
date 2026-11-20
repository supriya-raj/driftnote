import { createNoteId, NOTE_SCHEMA_VERSION } from "@driftnote/shared";
import { OpenNote } from "./noteDoc";

/** Creates a note in this browser (no server needed) and returns its ID once saved. */
export async function createNote(now = Date.now()): Promise<string> {
  const note = new OpenNote(createNoteId());
  try {
    await note.loaded;
    note.doc.transact(() => {
      note.meta.set("title", "");
      note.meta.set("createdAt", now);
      note.meta.set("schemaVersion", NOTE_SCHEMA_VERSION);
    });
    await note.whenSaved();
    return note.noteId;
  } finally {
    await note.close();
  }
}
