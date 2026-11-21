// Tells on-screen lists (the sidebar) to re-read after a change in this tab, to the note
// list cache or to a note's access record.
const changes = new EventTarget();

export function subscribeToNoteChanges(listener: () => void): () => void {
  changes.addEventListener("change", listener);
  return () => changes.removeEventListener("change", listener);
}

export function notifyNoteChange(): void {
  changes.dispatchEvent(new Event("change"));
}
