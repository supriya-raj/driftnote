import { useSyncExternalStore, type KeyboardEvent, type Ref } from "react";
import type { OpenNote } from "../notes/noteDoc";
import { useNoteEditable } from "../notes/useNoteEditable";

/** The note's title, stored in `meta.title` so renames sync like any other edit. */
export function NoteTitle({
  note,
  autoFocus = false,
  onEnter,
  ref,
}: {
  note: OpenNote;
  ref?: Ref<HTMLInputElement>;
  /** Focus the title when it appears (a brand-new note: naming it is the next step). */
  autoFocus?: boolean;
  /** Enter in the title: move on to the text. */
  onEnter: () => void;
}) {
  const title = useNoteTitle(note);
  const editable = useNoteEditable(note);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  }

  return (
    <input
      ref={ref}
      readOnly={!editable}
      className="note-title"
      aria-label="Title"
      placeholder="Untitled"
      value={title}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      onChange={(e) => note.meta.set("title", e.target.value)}
    />
  );
}

/** The note's current title ("" if none), re-rendering when it changes. */
export function useNoteTitle(note: OpenNote): string {
  return useSyncExternalStore(
    (onChange) => {
      note.meta.observe(onChange);
      return () => note.meta.unobserve(onChange);
    },
    () => {
      const value = note.meta.get("title");
      return typeof value === "string" ? value : "";
    },
  );
}
