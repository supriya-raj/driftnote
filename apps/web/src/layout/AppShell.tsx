import { useEffect, useRef, type MouseEvent } from "react";
import { Outlet, useLocation, useMatch } from "react-router";
import { LiveRegion } from "../a11y/announce";
import { UpdatePrompt } from "../UpdatePrompt";
import "./AppShell.css";
import { NEW_NOTE_BUTTON_ID, Sidebar } from "./Sidebar";

export const MAIN_ID = "main";

/**
 * Two panes: the note list (sidebar) and the open note. On narrow screens only one is
 * shown: the list on `/`, the note on `/n/:id` (with a back link).
 */
export function AppShell() {
  const noteMatch = useMatch("/n/:noteId");
  useFocusNotLostOnNavigation();
  return (
    <div className="app-shell" data-view={noteMatch ? "note" : "list"}>
      {/* First stop for keyboard users: past the note list, straight to the content. */}
      <a className="skip-link" href={`#${MAIN_ID}`} onClick={skipToMain}>
        Skip to main content
      </a>
      <Sidebar activeNoteId={noteMatch?.params.noteId ?? null} />
      <main className="app-main" id={MAIN_ID} tabIndex={-1}>
        <Outlet />
      </main>
      <UpdatePrompt />
      <LiveRegion scope="page" />
    </div>
  );
}

/** Moves focus to <main> without changing the URL (its fragment may hold a share token). */
function skipToMain(event: MouseEvent): void {
  event.preventDefault();
  document.getElementById(MAIN_ID)?.focus();
}

/**
 * After a navigation, if the focused element was removed (the deleted note's button, the
 * phone's back link, a list that is hidden on phones), focus would fall back to <body> and
 * a keyboard user would start again from the top. Put it on "New note" on the list page.
 * (Opening a note focuses its title itself: NotePage.)
 */
function useFocusNotLostOnNavigation(): void {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    // On a fresh page load nothing has focus yet, and the first Tab should reach the skip
    // link: only react to navigations within the app (the path changed).
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (pathname !== "/") return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      document.getElementById(NEW_NOTE_BUTTON_ID)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
}
