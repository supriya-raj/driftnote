import { useSyncExternalStore } from "react";
import type { OpenNote } from "./noteDoc";

/** Re-renders when the note's `meta` changes; true while this app may edit the note. */
export function useNoteEditable(note: OpenNote): boolean {
  return useSyncExternalStore(
    (onChange) => {
      note.meta.observe(onChange);
      return () => {
        note.meta.unobserve(onChange);
      };
    },
    () => note.isEditable,
  );
}
