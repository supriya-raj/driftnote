import "@blocknote/mantine/style.css";
import "./NoteEditor.css";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useSyncExternalStore } from "react";
import { useColorScheme } from "../lib/useColorScheme";
import type { OpenNote } from "../notes/noteDoc";
import { isSafeLinkHref, openLinkSafely } from "../notes/safeLinks";
import { noteSchema } from "../notes/schema";
import { useNoteEditable } from "../notes/useNoteEditable";

// Placeholder identity until presence (T33) asks for a name and colour.
const LOCAL_USER = { name: "Me", color: "#0f6e7a" };

export function NoteEditor({ note }: { note: OpenNote }) {
  const localState = useSyncExternalStore(note.subscribe, () => note.localState);
  const editable = useNoteEditable(note);
  const colorScheme = useColorScheme();
  const editor = useCreateBlockNote(
    {
      schema: noteSchema,
      links: { isValidLink: isSafeLinkHref, onClick: openLinkSafely },
      // The editor reads and writes the note's Y.XmlFragment directly (ADR 003).
      extensions: [CollaborationExtension({ fragment: note.content, user: LOCAL_USER })],
    },
    [note],
  );

  return (
    <div className="note-editor" data-testid="note-editor" data-local-state={localState}>
      <BlockNoteView editor={editor} editable={editable} theme={colorScheme} />
    </div>
  );
}
