import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { deleteNoteLocally } from "../notes/deleteNote";
import type { OpenNote } from "../notes/noteDoc";
import "./DeleteNoteButton.css";

export function DeleteNoteButton({ note }: { note: OpenNote }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  // While the confirmation is open: focus "Cancel" (the safe choice), and close on Escape
  // or a click elsewhere.
  useEffect(() => {
    if (!confirming) return;
    cancelButton.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setConfirming(false);
    };
    const onPointer = (e: PointerEvent): void => {
      if (!wrapper.current?.contains(e.target as Node)) setConfirming(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [confirming]);

  async function onConfirm(): Promise<void> {
    setDeleting(true);
    await deleteNoteLocally(note);
    await navigate("/");
  }

  return (
    <div className="delete-note" ref={wrapper}>
      <button
        type="button"
        className="btn btn-ghost-danger"
        aria-expanded={confirming}
        onClick={() => setConfirming((open) => !open)}
      >
        <Icon name="trash" />
        Delete note
      </button>
      {confirming && (
        <div role="alertdialog" aria-labelledby="delete-note-title" className="popover">
          <p id="delete-note-title" className="popover-title">
            Delete this note?
          </p>
          <p className="popover-text">
            It will be removed from this browser. This can’t be undone.
          </p>
          <div className="popover-actions">
            <button
              ref={cancelButton}
              type="button"
              className="btn btn-secondary"
              disabled={deleting}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleting}
              onClick={() => void onConfirm()}
            >
              Yes, delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
