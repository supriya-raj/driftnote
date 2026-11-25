import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { LogoMark } from "../components/Logo";
import { formatEdited } from "../lib/relativeTime";
import { useNow } from "../lib/useNow";
import { createNote } from "../notes/createNote";
import { getAllAccess } from "../notes/access";
import { listNotes, subscribeToNoteList, type NoteListEntry } from "../notes/noteList";
import type { NoteNavigation } from "../pages/NotePage";
import { ProfileButton } from "../presence/ProfileButton";
import { StorageWarning } from "../storage/StorageWarning";
import "./Sidebar.css";

/** Where focus goes when the list page opens after a note disappears (AppShell). */
export const NEW_NOTE_BUTTON_ID = "new-note-button";

export function Sidebar({ activeNoteId }: { activeNoteId: string | null }) {
  const navigate = useNavigate();
  const notes = useNoteList();
  const now = useNow();
  const [creating, setCreating] = useState(false);

  async function onNewNote(): Promise<void> {
    setCreating(true);
    try {
      const noteId = await createNote();
      await navigate(`/n/${noteId}`, { state: { focusTitle: true } satisfies NoteNavigation });
    } finally {
      setCreating(false);
    }
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <Link to="/" className="brand">
          <LogoMark />
          <h1 className="brand-name">Driftnote</h1>
        </Link>
      </header>

      <div className="sidebar-actions">
        <button
          id={NEW_NOTE_BUTTON_ID}
          type="button"
          className="btn btn-primary btn-block"
          disabled={creating}
          onClick={() => void onNewNote()}
        >
          <Icon name="plus" />
          New note
        </button>
      </div>

      <nav className="sidebar-notes" aria-label="Note navigation">
        {notes === null ? null : notes.length === 0 ? (
          <div className="sidebar-empty">
            <p className="sidebar-empty-title">No notes yet</p>
            <p>Notes are saved in this browser and work offline.</p>
          </div>
        ) : (
          <>
            <h2 className="sidebar-section">
              All notes <span className="sidebar-count">{notes.length}</span>
            </h2>
            <ul className="note-list" aria-label="Notes">
              {notes.map((note) => (
                <li
                  key={note.noteId}
                  className="note-list-item"
                  data-active={note.noteId === activeNoteId || undefined}
                >
                  <Link
                    to={`/n/${note.noteId}`}
                    className="note-list-link"
                    data-untitled={!note.title || undefined}
                    aria-current={note.noteId === activeNoteId ? "page" : undefined}
                  >
                    {note.title || "Untitled"}
                  </Link>
                  <span className="note-list-meta">
                    {formatEdited(note.updatedAt, now)}
                    {note.unsynced && (
                      <span
                        className="note-list-unsynced"
                        title="Changes are only in this browser. Open the note while online to back it up."
                      >
                        <Icon name="cloudOff" size={12} />
                        Not backed up
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      <footer className="sidebar-footer">
        <StorageWarning />
        <ProfileButton />
      </footer>
    </aside>
  );
}

type ListedNote = NoteListEntry & { unsynced: boolean };

/**
 * The note list plus each note's "not backed up" flag, re-read whenever either changes
 * in this tab. `null` while loading.
 */
function useNoteList(): ListedNote[] | null {
  const [notes, setNotes] = useState<ListedNote[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = (): void => {
      void Promise.all([listNotes(), getAllAccess()]).then(([entries, access]) => {
        if (cancelled) return;
        // No access record yet means never synced: not backed up.
        setNotes(entries.map((e) => ({ ...e, unsynced: access.get(e.noteId)?.unsynced ?? true })));
      });
    };
    load();
    const unsubscribe = subscribeToNoteList(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  return notes;
}
