import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { PRESENCE_COLORS, setIdentity, useIdentity } from "./identity";
import "./presence.css";

/** "You: <name>" in the sidebar; opens a small dialog to change name and colour. */
export function ProfileButton() {
  const identity = useIdentity();
  const [editing, setEditing] = useState(false);
  return (
    <>
      <button type="button" className="profile-button" onClick={() => setEditing(true)}>
        <Avatar name={identity.name} color={identity.color} size={28} />
        <span className="profile-text">
          <span className="profile-caption" aria-hidden="true">
            You
          </span>
          <span className="visually-hidden">You: </span>
          <span className="profile-name">{identity.name}</span>
        </span>
      </button>
      {editing && <ProfileDialog onClose={() => setEditing(false)} />}
    </>
  );
}

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const identity = useIdentity();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(identity.name);
  const [color, setColor] = useState(identity.color);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="profile-dialog"
      aria-labelledby="profile-title"
      onClose={onClose}
    >
      <form
        method="dialog"
        onSubmit={() => {
          setIdentity({ name, color });
        }}
      >
        <h2 id="profile-title">How others see you</h2>
        <p className="profile-help">
          Shown next to your cursor in shared notes. It is not verified: anyone can pick any name.
        </p>
        <div className="profile-preview">
          <Avatar name={name || "?"} color={color} size={36} />
          <span>{name || "Your name"}</span>
        </div>
        <label className="field-label" htmlFor="profile-name">
          Your name
        </label>
        <input
          id="profile-name"
          className="text-input"
          value={name}
          maxLength={40}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
        />
        <fieldset className="color-field">
          <legend className="field-label">Colour</legend>
          <div className="color-swatches">
            {PRESENCE_COLORS.map((c) => (
              <label key={c} className="color-swatch" style={{ background: c }}>
                <input
                  type="radio"
                  name="color"
                  value={c}
                  checked={c === color}
                  onChange={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="profile-actions">
          <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
