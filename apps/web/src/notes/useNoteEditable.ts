import { useSyncExternalStore } from "react";
import type { OpenNote } from "./noteDoc";

function subscribeToMeta(note: OpenNote) {
  return (onChange: () => void): (() => void) => {
    note.meta.observe(onChange);
    return () => {
      note.meta.unobserve(onChange);
    };
  };
}

/** True while this browser may edit the note: a supported schema and not a viewer. */
export function useNoteEditable(note: OpenNote): boolean {
  return useSyncExternalStore(subscribeToMeta(note), () => note.isEditable);
}

/** False when the note uses a newer schema than this app (ADR 012). */
export function useSchemaSupported(note: OpenNote): boolean {
  return useSyncExternalStore(subscribeToMeta(note), () => note.isSchemaSupported);
}
