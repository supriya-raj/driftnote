import { useSyncExternalStore } from "react";
import type { OpenNote } from "../notes/noteDoc";
import { useNoteEditable } from "../notes/useNoteEditable";

/** The note's title, stored in `meta.title` so renames sync like any other edit. */
export function NoteTitle({ note }: { note: OpenNote }) {
  const title = useSyncExternalStore(
    (onChange) => {
      note.meta.observe(onChange);
      return () => {
        note.meta.unobserve(onChange);
      };
    },
    () => {
      const value = note.meta.get("title");
      return typeof value === "string" ? value : "";
    },
  );

  const editable = useNoteEditable(note);

  return (
    <input
      readOnly={!editable}
      className="note-title"
      aria-label="Title"
      placeholder="Untitled"
      value={title}
      onChange={(e) => note.meta.set("title", e.target.value)}
    />
  );
}
