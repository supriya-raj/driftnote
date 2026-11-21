import { isNoteId } from "@driftnote/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Icon, type IconName } from "../components/Icon";
import { ensureAccess, getAccess, type NoteAccess } from "../notes/access";
import { setCurrentNote } from "../notes/currentNote";
import { noteExistsLocally, OpenNote } from "../notes/noteDoc";
import { keepListEntryInSync } from "../notes/noteList";
import { acceptLinkFromUrl } from "../notes/openLink";
import { PeopleHere } from "../presence/PeopleHere";
import { NoteSync } from "../sync/noteSync";
import { DeleteNoteButton } from "./DeleteNoteButton";
import { NoteEditor } from "./NoteEditor";
import "./NotePage.css";
import { NoteTitle } from "./NoteTitle";
import { SchemaGateNotice } from "./SchemaGateNotice";
import { ShareDialog } from "./ShareDialog";
import { SyncStatus } from "./SyncStatus";
import { SyncStoppedNotice } from "./SyncStoppedNotice";

interface OpenState {
  kind: "open";
  note: OpenNote;
  sync: NoteSync;
  access: NoteAccess;
}

type PageState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "invalid-link" }
  | { kind: "link-offline" }
  | OpenState;

export function NotePage() {
  const { noteId = "" } = useParams();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  // Opening a share link for the note already on screen only changes the URL fragment,
  // which does not reload the page; re-run the open logic so the link is handled.
  const [linkOpened, setLinkOpened] = useState(0);
  useEffect(() => {
    const onHashChange = (): void => {
      if (location.hash.includes("t=")) setLinkOpened((n) => n + 1);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    // Read through a function: TypeScript would otherwise assume a flag checked before an
    // `await` still has the same value after it, but the cleanup below can change it.
    let cancelled = false;
    const isCancelled = (): boolean => cancelled;
    let opened: OpenNote | null = null;
    let sync: NoteSync | null = null;
    let stopListSync = (): void => undefined;

    async function open(): Promise<void> {
      if (!isNoteId(noteId)) {
        setState({ kind: "missing" });
        return;
      }
      const link = await acceptLinkFromUrl(noteId);
      if (isCancelled()) return;
      if (link === "invalid" || link === "offline") {
        setState({ kind: link === "invalid" ? "invalid-link" : "link-offline" });
        return;
      }
      // Check first: opening a note's database would create it. A note this browser has
      // access to (e.g. from a share link) may not be stored here yet; syncing fetches it.
      const known = (await noteExistsLocally(noteId)) || (await getAccess(noteId)) !== undefined;
      if (isCancelled()) return;
      if (!known) {
        setState({ kind: "missing" });
        return;
      }
      const note = new OpenNote(noteId);
      opened = note;
      await note.loaded;
      if (isCancelled()) return;
      const access = await ensureAccess(noteId);
      if (isCancelled()) return;
      note.setRole(access.role); // a viewer's browser never writes to the note
      stopListSync = keepListEntryInSync(note);
      sync = new NoteSync(note, access);
      setCurrentNote(note);
      setState({ kind: "open", note, sync, access });
    }

    void open();
    return () => {
      cancelled = true;
      stopListSync();
      setCurrentNote(null);
      setState({ kind: "loading" });
      sync?.destroy();
      void opened?.close();
    };
  }, [noteId, linkOpened]);

  return (
    <div className="note-page">
      <div className="note-toolbar">
        <Link to="/" className="btn btn-ghost note-back">
          <Icon name="arrowLeft" />
          All notes
        </Link>
        {state.kind === "open" && (
          <div className="note-toolbar-actions">
            <PeopleHere sync={state.sync} />
            {state.access.role === "view" && (
              <span className="role-chip" title="You can read this note but not change it">
                <Icon name="eye" size={14} />
                View only
              </span>
            )}
            <SyncStatus note={state.note} sync={state.sync} />
            {state.access.role === "owner" && <ShareButton open={state} />}
            <DeleteNoteButton note={state.note} />
          </div>
        )}
      </div>

      {state.kind === "invalid-link" && (
        <PageMessage
          icon="lock"
          title="This link is no longer valid"
          text="The owner may have revoked it, or the note was deleted. Ask them for a new link."
        />
      )}

      {state.kind === "link-offline" && (
        <PageMessage
          icon="cloudOff"
          title="You’re offline"
          text="Opening a shared note needs a connection the first time. Try again once you’re online."
        />
      )}

      {state.kind === "missing" && (
        <PageMessage
          icon="search"
          title="Note not found"
          text="This note doesn’t exist in this browser. It may have been deleted."
        />
      )}

      {state.kind === "open" && (
        <article className="note-content" key={state.note.noteId}>
          <SyncStoppedNotice sync={state.sync} />
          <SchemaGateNotice note={state.note} />
          <NoteTitle note={state.note} />
          <NoteEditor note={state.note} sync={state.sync} />
        </article>
      )}
    </div>
  );
}

function ShareButton({ open }: { open: OpenState }) {
  const [sharing, setSharing] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary toolbar-btn"
        onClick={() => setSharing(true)}
      >
        <Icon name="share" />
        <span className="btn-label">Share</span>
      </button>
      {sharing && (
        <ShareDialog
          noteId={open.note.noteId}
          access={open.access}
          sync={open.sync}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
}

function PageMessage({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="note-missing">
      <div className="note-missing-icon">
        <Icon name={icon} size={24} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      <Link to="/" className="btn btn-secondary">
        Back to all notes
      </Link>
    </div>
  );
}
