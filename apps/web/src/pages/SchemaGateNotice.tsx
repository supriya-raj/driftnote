import type { OpenNote } from "../notes/noteDoc";
import { useNoteEditable } from "../notes/useNoteEditable";

export function SchemaGateNotice({ note }: { note: OpenNote }) {
  if (useNoteEditable(note)) return null;
  return (
    <div role="alert" className="schema-gate">
      This note was edited with a newer version of Driftnote, so it is read-only here. Update the
      app (reload the page) to edit it.
    </div>
  );
}
