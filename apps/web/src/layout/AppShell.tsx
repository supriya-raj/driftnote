import { Outlet, useMatch } from "react-router";
import { UpdatePrompt } from "../UpdatePrompt";
import "./AppShell.css";
import { Sidebar } from "./Sidebar";

/**
 * Two panes: the note list (sidebar) and the open note. On narrow screens only one is
 * shown: the list on `/`, the note on `/n/:id` (with a back link).
 */
export function AppShell() {
  const noteMatch = useMatch("/n/:noteId");
  return (
    <div className="app-shell" data-view={noteMatch ? "note" : "list"}>
      <Sidebar activeNoteId={noteMatch?.params.noteId ?? null} />
      <main className="app-main">
        <Outlet />
      </main>
      <UpdatePrompt />
    </div>
  );
}
