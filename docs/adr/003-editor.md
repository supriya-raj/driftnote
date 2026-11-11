# ADR 003: Rich-text editor

- **Status:** Proposed
- **Date:** 2026-11-11

## Context

Raw `contenteditable` produces inconsistent HTML across browsers and cannot be merged or
synced reliably. Robust editors keep their own structured document model, render it into
a `contenteditable` surface, and translate every input into precise model changes.

ProseMirror is the leading engine of this kind: a **schema** defines what the document may
contain, and every edit is a **transaction**. `y-prosemirror` binds a ProseMirror document to
a `Y.XmlFragment`, which is the `content` field of each note's `Y.Doc` (ADR 002).

Requirements: rich text, Yjs collaboration (ADR 001), remote cursors with names/colours
(M2), React frontend, accessibility work (M5), performance on 10k+ word documents (M5).
Integration posture (ADR 001): prefer ready-made pieces.

## Options considered

### A. TipTap (headless wrapper over ProseMirror)
- Pros: official Yjs Collaboration and collaboration-cursor extensions; React bindings;
  large extension library; headless (full control of UI); ProseMirror remains accessible
  underneath.
- Cons: an extra abstraction layer when debugging; some features are paid or tied to
  TipTap Cloud (hosted collab, hosted history, Pro extensions); not needed, but docs and
  tutorials must be read with that in mind.
- Right when: you want a capable editor fast with first-class Yjs collaboration.

### B. Raw ProseMirror + `y-prosemirror`
- Pros: maximum understanding and control; no hidden layer.
- Cons: much more code (schema, keymaps, commands, React integration) before basic
  formatting works; shifts the project's focus from local-first to editor-building.
- Right when: the editor itself is the object of study.

### C. Lexical (Meta)
- Pros: modern, fast, React-first, strong accessibility focus; `@lexical/yjs` exists.
- Cons: Yjs binding less mature/used than `y-prosemirror`; different model from the
  ProseMirror stack named in the brief.
- Right when: React-first teams prioritising accessibility without deep Yjs needs.

### D. BlockNote (Notion-style, built on TipTap)
- Pros: fastest path to a polished block editor with Yjs collaboration preconfigured.
- Cons: hides the most; least learning about editor internals; opinionated UI that is
  harder to customise.
- Right when: you need a Notion-like product quickly and internals are not the goal.

## Decision

Proposed: **TipTap** (open-source extensions only), bound to each note's
`Y.XmlFragment` via the Collaboration extension, with the collaboration cursor
extension for presence.

Open questions (to be resolved before acceptance):
1. Initial formatting set. Proposed: paragraphs, headings, bold, italic, strike,
   bullet/ordered/task lists, links, inline code, code blocks, blockquotes. Deferred:
   images, tables, colours, mentions.
2. UI style: plain document (proposed) vs. Notion-style blocks.

## Consequences

- The editor's built-in undo/redo must be disabled; undo uses Yjs's `Y.UndoManager`
  (via the Collaboration extension) so a user's undo affects only their own changes.
- The ProseMirror schema (which nodes/marks exist) becomes part of the stored data
  format: adding nodes is safe, removing or renaming them needs a migration plan (see
  future ADR on schema evolution).
- Images/attachments, if added later, must be stored outside the CRDT (blob storage
  referenced by ID) to avoid bloating document history.
- Avoid paid / TipTap Cloud-only features to keep the stack self-hostable.
- TipTap major-version upgrades may require extension API changes; pin versions.
