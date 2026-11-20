import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { OpenNote } from "../notes/noteDoc";
import { NoteEditor } from "./NoteEditor";

export function NotePage() {
  const { noteId = "" } = useParams();
  const [note, setNote] = useState<OpenNote | null>(null);

  useEffect(() => {
    const opened = new OpenNote(noteId);
    let cancelled = false;
    void opened.loaded.then(() => {
      if (!cancelled) setNote(opened);
    });
    return () => {
      cancelled = true;
      setNote(null);
      void opened.close();
    };
  }, [noteId]);

  return (
    <main>
      <nav>
        <Link to="/">All notes</Link>
      </nav>
      {note ? <NoteEditor key={note.noteId} note={note} /> : <p>Loading…</p>}
    </main>
  );
}
