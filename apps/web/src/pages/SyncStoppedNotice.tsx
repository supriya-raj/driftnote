import {
  CLOSE_INVALID_TOKEN,
  CLOSE_NOTE_DELETED,
  CLOSE_PROTOCOL_TOO_OLD,
  CLOSE_TOO_LARGE,
} from "@driftnote/shared";
import { useSyncExternalStore } from "react";
import { Icon } from "../components/Icon";
import type { NoteSync } from "../sync/noteSync";

const MESSAGES: Record<number, { title: string; text: string }> = {
  [CLOSE_INVALID_TOKEN]: {
    title: "This link is no longer valid",
    text: "The owner revoked it. You can still read what is here, but changes will not sync.",
  },
  [CLOSE_NOTE_DELETED]: {
    title: "This note was deleted by its owner",
    text: "It no longer exists on the server. What you see is only in this browser.",
  },
  [CLOSE_TOO_LARGE]: {
    title: "This note is too large to sync",
    text: "The server refused a change that would make the note too big.",
  },
  [CLOSE_PROTOCOL_TOO_OLD]: {
    title: "Driftnote needs an update",
    text: "Reload the page to get the latest version, then this note will sync again.",
  },
};

/** Explains why syncing stopped for good (a close code that retrying cannot fix). */
export function SyncStoppedNotice({ sync }: { sync: NoteSync }) {
  const state = useSyncExternalStore(sync.subscribe, () => sync.syncState);
  const message = sync.closeCode === null ? undefined : MESSAGES[sync.closeCode];
  if (state !== "stopped" || !message) return null;
  return (
    <div role="alert" className="notice notice-warning note-notice">
      <Icon name="alert" />
      <div>
        <p className="notice-title">{message.title}</p>
        <p>{message.text}</p>
      </div>
    </div>
  );
}
