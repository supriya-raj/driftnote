import * as Y from "yjs";
import { getCurrentNote } from "./notes/currentNote";
import { deleteNoteList } from "./notes/noteList";
import type { DriftnoteTestHooks } from "./testHooksApi";

declare global {
  interface Window {
    __driftnote?: DriftnoteTestHooks;
  }
}

/** Origin for hook edits, so they look like they came from elsewhere. */
const TEST_REMOTE_ORIGIN = Symbol("test-remote");

export function installTestHooks(): void {
  window.__driftnote = {
    clearNoteList: deleteNoteList,
    setSchemaVersion(version) {
      const note = getCurrentNote();
      note.doc.transact(() => note.meta.set("schemaVersion", version), TEST_REMOTE_ORIGIN);
    },
    injectLink(text, href) {
      const note = getCurrentNote();
      // BlockNote's ProseMirror tree: blockGroup > blockContainer > paragraph > text.
      // y-prosemirror stores a mark as a text format attribute named after the mark.
      const existing = note.content.length > 0 ? note.content.get(0) : null;
      if (existing && !(existing instanceof Y.XmlElement)) throw new Error("Unexpected doc shape");
      const blockGroup = existing ?? new Y.XmlElement("blockGroup");
      const container = new Y.XmlElement("blockContainer");
      const paragraph = new Y.XmlElement("paragraph");
      const textNode = new Y.XmlText();
      note.doc.transact(() => {
        if (!existing) note.content.insert(0, [blockGroup]);
        container.setAttribute("id", `test-${String(Date.now())}`);
        paragraph.insert(0, [textNode]);
        container.insert(0, [paragraph]);
        blockGroup.push([container]);
        textNode.insert(0, text, { link: { href } });
      }, TEST_REMOTE_ORIGIN);
    },
  };
}
