# ADR 003: Rich-text editor

- **Status:** Accepted (2026-11-11)
- **Date:** 2026-11-11

## Context

The browser's built-in `contenteditable` attribute turns an element into an editable
region and handles the hard parts of text input (cursor/selection, IME composition,
mobile keyboards, spellcheck, accessibility, clipboard). But it produces inconsistent HTML
across browsers, enforces no structure, and does not report *what* changed, only the
resulting HTML. Sync (ADR 001) needs precise changes.

Robust editors therefore keep their own structured document model, use `contenteditable`
only as the input/rendering surface, translate every input into a model change, and
re-render from the model. ProseMirror is the leading engine of this kind: a **schema**
defines what the document may contain, and every edit is a **transaction**.
`y-prosemirror` binds a ProseMirror document to a `Y.XmlFragment`, which is the `content`
field of each note's `Y.Doc` (ADR 002).

Requirements: rich text, Yjs collaboration (ADR 001), remote cursors with names/colours
(M2), React frontend, accessibility work (M5), performance on 10k+ word documents (M5).
Integration posture (ADR 001): prefer ready-made pieces.

The brief proposed TipTap; this ADR records a change from that.

## Options considered

### A. TipTap (headless wrapper over ProseMirror)
- Pros: official Yjs Collaboration and collaboration-cursor extensions; React bindings;
  large extension library; headless (full control of UI); ProseMirror one layer down.
- Cons: extra abstraction when debugging; some features paid or tied to TipTap Cloud;
  all UI (toolbars, menus) must be built.
- Right when: you want a capable editor fast with first-class Yjs collaboration and
  full control over the UI.

### B. Raw ProseMirror + `y-prosemirror`
- Pros: maximum understanding and control; no hidden layer.
- Cons: much more code before basic formatting works; shifts the project's focus from
  local-first to editor-building.
- Right when: the editor itself is the object of study.

### C. Lexical (Meta)
- Pros: modern, fast, React-first, strong accessibility focus; `@lexical/yjs` exists.
- Cons: Yjs binding less mature/used than `y-prosemirror`; different model from the
  ProseMirror stack.
- Right when: React-first teams prioritising accessibility without deep Yjs needs.

### D. BlockNote (Notion-style block editor built on TipTap/ProseMirror)
- Pros: fastest path to a polished block editor (drag handles, slash menu, formatting
  toolbar); Yjs collaboration, remote cursors and collaboration-aware undo preconfigured;
  still ProseMirror underneath.
- Cons: hides the most (three layers above `contenteditable`), so editor internals are
  learned only by deliberate digging; opinionated block UI and block-based schema that
  is harder to customise; some packages are GPL/commercial.
- Right when: you want a Notion-like product quickly and are willing to study internals
  separately.

## Decision

**BlockNote**, chosen by the project owner for its Notion-style UX and
built-in collaboration.

- Use only BlockNote's open-source (MPL-2.0) core packages; avoid the GPL/commercial
  "XL" packages (multi-column, AI, PDF/DOCX export, etc.).
- Bind the editor to each note's `Y.XmlFragment` (`content`) and the sync provider's
  awareness for presence (user name and colour).
- UI kit: start with the default (Mantine); evaluate the Ariakit variant during M5
  accessibility work.

Resolved questions:
1. Media/file blocks: removed from the schema for now (image, video, audio, file).
   Tables and standard text blocks are kept.
2. Learning goal: the owner accepts the trade-off; the brief's editor learning goal is
   revised to focus on how a block editor integrates with a CRDT, with internals studied
   by deliberately digging through BlockNote, TipTap and ProseMirror.

## Consequences

- Undo/redo must be collaboration-aware (Yjs `Y.UndoManager`), so a user's undo affects
  only their own changes; BlockNote provides this when collaboration is enabled.
- BlockNote's block schema becomes part of the stored data format: adding block types is
  safe; removing or renaming them needs a migration plan (see future ADR on schema
  evolution). BlockNote major upgrades may change the schema; pin versions.
- Images/attachments, if added later, must be stored outside the CRDT (blob storage
  referenced by ID) to avoid bloating document history.
- Accessibility (M5) is partly constrained by BlockNote's built-in UI components.
- Suggested learning-log entry: trace one keystroke from `contenteditable` through
  ProseMirror's transaction to the Yjs update.
