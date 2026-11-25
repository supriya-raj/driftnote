import "@blocknote/mantine/style.css";
import "./NoteEditor.css";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { NOTE_CONTENT_KEY } from "@driftnote/shared";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { XmlFragment } from "yjs";
import { useColorScheme } from "../lib/useColorScheme";
import type { OpenNote } from "../notes/noteDoc";
import { repairEditorAria } from "../notes/editorAria";
import { isSafeLinkHref, openLinkSafely } from "../notes/safeLinks";
import { noteSchema } from "../notes/schema";
import { useIdentity } from "../presence/identity";
import type { NoteSync } from "../sync/noteSync";
import { useNoteEditable } from "../notes/useNoteEditable";

const EDITOR_KEYS_HINT_ID = "note-editor-keys";

/** What the rest of the note page may do with the editor. */
export interface EditorHandle {
  /** Puts the caret at the start of the text and focuses it. */
  focusStart(): void;
}

export function NoteEditor({
  note,
  sync,
  handleRef,
  onEscape,
}: {
  note: OpenNote;
  sync: NoteSync;
  handleRef: RefObject<EditorHandle | null>;
  /** Escape in the text (no editor menu open): the way out, since Tab indents there. */
  onEscape: () => void;
}) {
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
      // The editable area is a text box: give it a name screen readers announce, and tell
      // them how to leave it (Tab indents here, so Tab alone never leaves: WCAG 2.1.2).
      domAttributes: {
        editor: { "aria-label": "Note text", "aria-describedby": EDITOR_KEYS_HINT_ID },
      },
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

  useEffect(() => {
    handleRef.current = {
      focusStart() {
        const first = editor.document[0];
        if (first) editor.setTextCursorPosition(first, "start");
        editor.focus();
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [editor, handleRef]);

  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => (wrapper.current ? repairEditorAria(wrapper.current) : undefined), []);

  return (
    <div
      ref={wrapper}
      className="note-editor"
      data-testid="note-editor"
      data-local-state={localState}
      onKeyDown={(event) => {
        // BlockNote's own Escape closes an open menu, or else blurs the editor, which would
        // leave focus on <body>. In that case, finish the job: focus goes to the title.
        if (event.key !== "Escape") return;
        if (!(event.target instanceof Element) || !event.target.closest(".bn-editor")) return;
        const active = document.activeElement;
        if (active && active !== document.body) return; // a menu closed; still in the text
        onEscape();
      }}
    >
      <BlockNoteView editor={editor} editable={editable} theme={colorScheme} />
      <span id={EDITOR_KEYS_HINT_ID} className="visually-hidden">
        Tab indents. Press Escape to leave the text.
      </span>
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
