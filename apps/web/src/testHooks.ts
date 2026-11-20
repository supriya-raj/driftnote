import { deleteNoteList } from "./notes/noteList";
import type { DriftnoteTestHooks } from "./testHooksApi";

declare global {
  interface Window {
    __driftnote?: DriftnoteTestHooks;
  }
}

export function installTestHooks(): void {
  window.__driftnote = {
    clearNoteList: deleteNoteList,
  };
}
