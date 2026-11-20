import { Icon } from "../components/Icon";
import type { OpenNote } from "../notes/noteDoc";
import { useNoteEditable } from "../notes/useNoteEditable";

export function SchemaGateNotice({ note }: { note: OpenNote }) {
  if (useNoteEditable(note)) return null;
  return (
    <div role="alert" className="notice notice-info note-notice">
      <Icon name="lock" />
      <div>
        <p className="notice-title">Read-only</p>
        <p>
          This note was edited with a newer version of Driftnote, so it is read-only here. Update
          the app (reload the page) to edit it.
        </p>
      </div>
    </div>
  );
}
