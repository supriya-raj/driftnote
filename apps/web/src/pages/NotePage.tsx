import { isNoteId } from "@driftnote/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Icon } from "../components/Icon";
import { setCurrentNote } from "../notes/currentNote";
import { noteExistsLocally, OpenNote } from "../notes/noteDoc";
import { keepListEntryInSync } from "../notes/noteList";
import { DeleteNoteButton } from "./DeleteNoteButton";
import { NoteEditor } from "./NoteEditor";
import "./NotePage.css";
import { NoteTitle } from "./NoteTitle";
import { SaveStatus } from "./SaveStatus";
import { SchemaGateNotice } from "./SchemaGateNotice";

type PageState = { kind: "loading" } | { kind: "missing" } | { kind: "open"; note: OpenNote };

export function NotePage() {
  const { noteId = "" } = useParams();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    // Read through a function: TypeScript would otherwise assume a flag checked before an
    // `await` still has the same value after it, but the cleanup below can change it.
    let cancelled = false;
    const isCancelled = (): boolean => cancelled;
    let opened: OpenNote | null = null;
    let stopListSync = (): void => undefined;

    async function open(): Promise<void> {
      // Check first: opening a note's database would create it.
      if (!isNoteId(noteId) || !(await noteExistsLocally(noteId))) {
        if (!isCancelled()) setState({ kind: "missing" });
        return;
      }
      if (isCancelled()) return;
      const note = new OpenNote(noteId);
      opened = note;
      await note.loaded;
      if (isCancelled()) return;
      stopListSync = keepListEntryInSync(note);
      setCurrentNote(note);
      setState({ kind: "open", note });
    }

    void open();
    return () => {
      cancelled = true;
      stopListSync();
      setCurrentNote(null);
      setState({ kind: "loading" });
      void opened?.close();
    };
  }, [noteId]);

  return (
    <div className="note-page">
      <div className="note-toolbar">
        <Link to="/" className="btn btn-ghost note-back">
          <Icon name="arrowLeft" />
          All notes
        </Link>
        {state.kind === "open" && (
          <div className="note-toolbar-actions">
            <SaveStatus note={state.note} />
            <DeleteNoteButton note={state.note} />
          </div>
        )}
      </div>

      {state.kind === "missing" && (
        <div className="note-missing">
          <div className="note-missing-icon">
            <Icon name="search" size={24} />
          </div>
          <h2>Note not found</h2>
          <p>This note doesn’t exist in this browser. It may have been deleted.</p>
          <Link to="/" className="btn btn-secondary">
            Back to all notes
          </Link>
        </div>
      )}

      {state.kind === "open" && (
        <article className="note-content" key={state.note.noteId}>
          <SchemaGateNotice note={state.note} />
          <NoteTitle note={state.note} />
          <NoteEditor note={state.note} />
        </article>
      )}
    </div>
  );
}
