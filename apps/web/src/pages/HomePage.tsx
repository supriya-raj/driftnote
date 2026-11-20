import { useState } from "react";
import { useNavigate } from "react-router";
import { createNote } from "../notes/createNote";

export function HomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  async function onNewNote(): Promise<void> {
    setCreating(true);
    try {
      const noteId = await createNote();
      await navigate(`/n/${noteId}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main>
      <h1>Driftnote</h1>
      <button type="button" disabled={creating} onClick={() => void onNewNote()}>
        New note
      </button>
    </main>
  );
}
