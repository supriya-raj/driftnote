import "@blocknote/mantine/style.css";
import "./NoteEditor.css";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { NOTE_CONTENT_KEY } from "@driftnote/shared";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { XmlFragment } from "yjs";
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
  const fragment = useEditorFragment(note, editable);
  const editor = useCreateBlockNote(
    {
      schema: noteSchema,
      links: { isValidLink: isSafeLinkHref, onClick: openLinkSafely },
      // The editor reads and writes the note's Y.XmlFragment directly (ADR 003).
      extensions: [CollaborationExtension({ fragment, user: LOCAL_USER })],
    },
    [fragment],
  );

  return (
    <div className="note-editor" data-testid="note-editor" data-local-state={localState}>
      <BlockNoteView editor={editor} editable={editable} theme={colorScheme} />
    </div>
  );
}

/**
 * The fragment the editor is bound to: the note's own content while this app may edit it,
 * otherwise a disposable copy kept up to date one way (see `OpenNote.createReadOnlyCopy`).
 */
function useEditorFragment(note: OpenNote, editable: boolean): XmlFragment {
  const copy = useMemo(() => (editable ? null : note.createReadOnlyCopy()), [note, editable]);
  useEffect(() => {
    if (!copy) return;
    const stop = note.forwardUpdatesTo(copy);
    return () => {
      stop();
      copy.destroy();
    };
  }, [note, copy]);
  return copy ? copy.getXmlFragment(NOTE_CONTENT_KEY) : note.content;
}
