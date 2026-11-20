import type { OpenNote } from "./noteDoc";

// The note shown on screen, for test hooks that act on "the open note".
let current: OpenNote | null = null;

export function setCurrentNote(note: OpenNote | null): void {
  current = note;
}

export function getCurrentNote(): OpenNote {
  if (!current) throw new Error("No note is open");
  return current;
}
