import { useSyncExternalStore } from "react";
import { Icon, type IconName } from "../components/Icon";
import type { OpenNote } from "../notes/noteDoc";
import type { NoteSync, SyncState } from "../sync/noteSync";

const LABELS: Record<SyncState, { text: string; icon: IconName | null; title: string }> = {
  synced: { text: "Synced", icon: "check", title: "Saved on the server" },
  syncing: { text: "Syncing…", icon: null, title: "Sending your changes to the server" },
  offline: {
    text: "Offline",
    icon: "cloudOff",
    title: "Changes are saved in this browser and will sync when the connection returns",
  },
  stopped: { text: "Not syncing", icon: "alert", title: "The server refused this note" },
};

/**
 * One quiet status for where the note's changes are: on the server (synced), on the way
 * (syncing), or only in this browser (offline). While offline it also shows when a change
 * is still being written locally.
 */
export function SyncStatus({ note, sync }: { note: OpenNote; sync: NoteSync }) {
  const state = useSyncExternalStore(sync.subscribe, () => sync.syncState);
  const local = useSyncExternalStore(note.subscribe, () => note.localState);
  const label = LABELS[state];
  const text = state === "offline" && local !== "saved" ? "Saving…" : label.text;
  return (
    <span
      className="sync-status"
      data-testid="sync-status"
      data-sync-state={state}
      title={label.title}
    >
      {label.icon ? <Icon name={label.icon} size={14} /> : <span className="sync-status-dot" />}
      {text}
    </span>
  );
}
