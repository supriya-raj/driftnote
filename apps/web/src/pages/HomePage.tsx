import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { createNote } from "../notes/createNote";
import { listNotes, type NoteListEntry } from "../notes/noteList";

export function HomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [notes, setNotes] = useState<NoteListEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listNotes().then((entries) => {
      if (!cancelled) setNotes(entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      {notes === null ? (
        <p>Loading…</p>
      ) : notes.length === 0 ? (
        <p>No notes yet.</p>
      ) : (
        <ul aria-label="Notes">
          {notes.map((n) => (
            <li key={n.noteId}>
              <Link to={`/n/${n.noteId}`}>{n.title || "Untitled"}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
