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
      appendBlock("paragraph", (textNode) => textNode.insert(0, text, { link: { href } }));
    },
    injectBlock(type, text) {
      appendBlock(type, (textNode) => textNode.insert(0, text));
    },
    storedContent() {
      return getCurrentNote().content.toJSON(); // the XML string
    },
  };
}

let blockCounter = 0;

/**
 * Appends `blockContainer > <type> > text` to the open note's fragment in one transaction.
 * BlockNote's ProseMirror tree is blockGroup > blockContainer > block > text, and
 * y-prosemirror stores a mark as a text format attribute named after the mark.
 */
function appendBlock(type: string, fillText: (text: Y.XmlText) => void): void {
  const note = getCurrentNote();
  const existing = note.content.length > 0 ? note.content.get(0) : null;
  if (existing && !(existing instanceof Y.XmlElement)) throw new Error("Unexpected doc shape");
  const blockGroup = existing ?? new Y.XmlElement("blockGroup");
  const container = new Y.XmlElement("blockContainer");
  const block = new Y.XmlElement(type);
  const textNode = new Y.XmlText();
  note.doc.transact(() => {
    if (!existing) note.content.insert(0, [blockGroup]);
    blockCounter += 1;
    container.setAttribute("id", `test-block-${String(blockCounter)}`);
    block.insert(0, [textNode]);
    container.insert(0, [block]);
    blockGroup.push([container]);
    fillText(textNode);
  }, TEST_REMOTE_ORIGIN);
}
