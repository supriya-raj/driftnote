import "@blocknote/mantine/style.css";
import "./NoteEditor.css";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { NOTE_CONTENT_KEY } from "@driftnote/shared";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { XmlFragment } from "yjs";
import { useColorScheme } from "../lib/useColorScheme";
import type { OpenNote } from "../notes/noteDoc";
import { repairEditorAria } from "../notes/editorAria";
import { isSafeLinkHref, openLinkSafely } from "../notes/safeLinks";
import { noteSchema } from "../notes/schema";
import { useIdentity } from "../presence/identity";
import type { NoteSync } from "../sync/noteSync";
import { useNoteEditable } from "../notes/useNoteEditable";

export function NoteEditor({ note, sync }: { note: OpenNote; sync: NoteSync }) {
  const localState = useSyncExternalStore(note.subscribe, () => note.localState);
  const editable = useNoteEditable(note);
  const colorScheme = useColorScheme();
  const fragment = useEditorFragment(note, editable);
  const identity = useIdentity();
  // Read once per editor: later changes go straight to awareness (effect below), which
  // avoids rebuilding the editor whenever the name changes.
  const [initialUser] = useState(identity);
  const awareness = sync.provider.awareness;
  const editor = useCreateBlockNote(
    {
      schema: noteSchema,
      // The editable area is a text box; give it a name screen readers can announce.
      domAttributes: { editor: { "aria-label": "Note text" } },
      links: { isValidLink: isSafeLinkHref, onClick: openLinkSafely },
      // The editor reads and writes the note's Y.XmlFragment directly (ADR 003), and
      // shares cursors through the sync provider's awareness. Cursor positions are Yjs
      // item IDs, so they also work on a read-only copy (an exact replica). The server
      // sends cursors only after the content (Room.sendPresenceOnce): a cursor pointing
      // into content not drawn yet makes the cursor plugin throw.

      extensions: [
        CollaborationExtension({
          fragment,
          user: { name: initialUser.name, color: initialUser.color },
          provider: { awareness },
        }),
      ],
    },
    [fragment],
  );

  useEffect(() => {
    awareness.setLocalStateField("user", { name: identity.name, color: identity.color });
  }, [awareness, identity]);

  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => (wrapper.current ? repairEditorAria(wrapper.current) : undefined), []);

  return (
    <div
      ref={wrapper}
      className="note-editor"
      data-testid="note-editor"
      data-local-state={localState}
    >
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
