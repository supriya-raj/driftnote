import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { OpenNote } from "../notes/noteDoc";
import { keepListEntryInSync } from "../notes/noteList";
import { NoteEditor } from "./NoteEditor";
import { NoteTitle } from "./NoteTitle";

export function NotePage() {
  const { noteId = "" } = useParams();
  const [note, setNote] = useState<OpenNote | null>(null);

  useEffect(() => {
    const opened = new OpenNote(noteId);
    let cancelled = false;
    let stopListSync = (): void => undefined;
    void opened.loaded.then(() => {
      if (cancelled) return;
      stopListSync = keepListEntryInSync(opened);
      setNote(opened);
    });
    return () => {
      cancelled = true;
      stopListSync();
      setNote(null);
      void opened.close();
    };
  }, [noteId]);

  return (
    <main>
      <nav>
        <Link to="/">All notes</Link>
      </nav>
      {note ? (
        <article key={note.noteId}>
          <NoteTitle note={note} />
          <NoteEditor note={note} />
        </article>
      ) : (
        <p>Loading…</p>
      )}
    </main>
  );
}
