# ADR 002: Document model

- **Status:** Proposed
- **Date:** 2026-11-11

## Context

In Yjs (ADR 001), all shared data lives in a `Y.Doc`. A `Y.Doc` is the unit of
persistence (saved as a whole), sync (clients connect per doc), sharing (access to a doc
is access to everything in it) and history (snapshots cover the whole doc).

We must decide how notes map onto `Y.Doc`s and where the note list lives. The brief
requires: no accounts, notes created fully offline, per-note sharing by link, per-note
version history, and good performance on large documents. This is hard to change once
real data exists.

## Options considered

### A. One `Y.Doc` containing all notes
- Pros: simplest; one persistence and sync connection.
- Cons: sharing one note shares all notes; loads everything to show one note; the doc
  (and its tombstones) grows forever; history is entangled across notes.
- Right when: single-user apps with no sharing.

### B. One `Y.Doc` per note, plus a synced "index" `Y.Doc` for the note list
- Pros: per-note sharing, history and lazy loading; note list can sync across a user's
  own devices.
- Cons: title/metadata duplicated between note and index and can drift; adds a second
  synced data type before it is needed; implies some notion of "a user's devices".
- Right when: multi-device sync of the note list is a requirement.

### C. One `Y.Doc` per note; note list is a local, non-CRDT cache
Each note doc holds its content and its metadata (title, created date). The note list is
an ordinary local table derived from the note docs on this device.
- Pros: per-note sharing, history and lazy loading; the note doc is the single source of
  truth (the list is rebuildable, so it cannot conflict); fits the no-account model;
  leaves room for SQLite-backed index/search (M6).
- Cons: note list does not sync across a user's devices; a note appears on another device
  only by opening its link there.
- Right when: no accounts, and the note is the unit of sharing.

### D. Yjs subdocuments (note docs nested in a root doc)
- Pros: official Yjs mechanism for lazy-loading nested docs.
- Cons: partial or missing support in Hocuspocus and `y-indexeddb`; works against the
  ecosystem chosen in ADR 001.
- Right when: you control the full stack and need lazy loading of large workspaces.

## Decision

Proposed: **C**.

- One `Y.Doc` per note, containing:
  - `content`: a `Y.XmlFragment` bound to the editor (rich text).
  - `meta`: a `Y.Map` with `title`, `createdAt` (and future small metadata).
- Note IDs are long random strings generated client-side (e.g. nanoid, about 21 chars), so
  creating a note needs no server and IDs are unguessable (relevant to ADR on sharing).
- The note list is a local cache (initially an IndexedDB store; later possibly
  SQLite-WASM) updated whenever a note doc's `meta` changes, and rebuildable from the
  note docs.

Open questions (to be resolved before acceptance):
1. Deleting a note shared with you: remove from my list only, or delete for everyone?
   (Proposed: remove from my list only.)
2. Is multi-device sync of the note list a requirement? (If yes, reconsider option B.)

## Consequences

- Sharing, sync and history all operate per note; the sync server keys rooms by note ID.
- Renaming a note is a CRDT edit to `meta.title`, so collaborators see renames.
- The local list must be kept in sync with note docs; a "rebuild index" routine is needed
  for recovery.
- Migrating later to option B is additive (add an index doc) and does not change note docs.
- Schema of `meta` must be versioned/evolvable (see future ADR on schema evolution).
