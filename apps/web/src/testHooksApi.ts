/**
 * Test hooks exposed as `window.__driftnote` in test builds only (`vite build --mode
 * test`). They set up situations a user cannot easily create by hand. This file has no
 * imports so the e2e tests (a separate TypeScript project) can use the type.
 */
export interface DriftnoteTestHooks {
  /** Deletes the note-list cache database, as if the browser had lost it. */
  clearNoteList(): Promise<void>;
  /**
   * Appends a paragraph containing a link to the open note by editing its Yjs fragment
   * directly, the way an update from another replica would arrive.
   */
  injectLink(text: string, href: string): void;
}
