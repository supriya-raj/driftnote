import { useState } from "react";
import { useNavigate } from "react-router";
import { deleteNoteLocally } from "../notes/deleteNote";
import type { OpenNote } from "../notes/noteDoc";

export function DeleteNoteButton({ note }: { note: OpenNote }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onConfirm(): Promise<void> {
    setDeleting(true);
    await deleteNoteLocally(note);
    await navigate("/");
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setConfirming(true);
        }}
      >
        Delete note
      </button>
    );
  }
  return (
    <div role="group" aria-label="Confirm delete">
      <span>Delete this note from this browser? This cannot be undone.</span>{" "}
      <button type="button" disabled={deleting} onClick={() => void onConfirm()}>
        Yes, delete
      </button>{" "}
      <button
        type="button"
        disabled={deleting}
        onClick={() => {
          setConfirming(false);
        }}
      >
        Cancel
      </button>
    </div>
  );
}
