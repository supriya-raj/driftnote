import { useSyncExternalStore } from "react";
import { Icon } from "../components/Icon";
import type { OpenNote } from "../notes/noteDoc";

/** Quiet indicator of whether every change is in this browser's storage. */
export function SaveStatus({ note }: { note: OpenNote }) {
  const state = useSyncExternalStore(note.subscribe, () => note.localState);
  const saved = state === "saved";
  return (
    <span
      className="save-status"
      data-state={state}
      title={saved ? "Every change is saved in this browser" : undefined}
    >
      {saved ? <Icon name="check" size={14} /> : <span className="save-status-dot" />}
      {saved ? "Saved" : "Saving…"}
    </span>
  );
}
