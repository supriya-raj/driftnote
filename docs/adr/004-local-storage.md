# ADR 004: Local storage

- **Status:** Accepted (2026-11-11)
- **Date:** 2026-11-11

## Context

Driftnote must work with no network and no account, and notes must survive reloads and
browser restarts (M1). What must be stored locally:

- Each note's `Y.Doc` (ADR 002), persisted as Yjs binary **updates**.
- The note-list cache (ADR 002): id, title, last-edited, per note.
- Later: version snapshots (future ADR) and small settings (display name, cursor colour).

Browser storage options: `localStorage` (about 5 MB, strings only, synchronous),
IndexedDB (asynchronous, binary-capable, large quota, clunky API), and OPFS (a private
file system that makes SQLite-WASM viable).

**Eviction risk:** browser storage is "best effort" by default and may be cleared under
storage pressure; Safari may clear script-writable storage after 7 days without user
interaction unless the site is installed to the home screen. A note that has never been
synced exists only in this browser.

## Options considered

### A. `y-indexeddb` for notes + small IndexedDB store (via `idb`) for the note list
- Pros: ready-made, widely used, works with BlockNote's Yjs setup; automatic compaction
  of stored updates; tiny wrapper for the list store.
- Cons: no querying/search across notes; compaction is opaque and discards the
  update-by-update log (relevant to version history).
- Right when: you want reliable persistence on day one.

### B. SQLite-WASM on OPFS for everything
- Pros: real SQL; full-text search (FTS5); single store for notes, list and history.
- Cons: Web Worker setup; ~1 MB WASM download; multi-tab access is tricky; custom Yjs
  persistence code required (no off-the-shelf binding).
- Right when: search or complex queries are needed (brief M6).

### C. Hand-written Yjs persistence on IndexedDB
- Pros: full understanding of append/replay/compaction; control over compaction (could
  double as a version-history base); ~100-150 lines.
- Cons: owning data-loss bugs; reinvents a solid library.
- Right when: persistence is the piece deliberately hand-built for learning.

### D. `localStorage`
- Pros: trivial API.
- Cons: ~5 MB, strings only (binary needs base64, about 33% larger), blocks the main thread.
- Right when: tiny settings only.

## Decision

**A** now; **B** as the M6 exploration for the note index and search.

- Notes: one `y-indexeddb` persistence per note doc, keyed by note ID.
- Note list: an IndexedDB object store accessed through `idb`, updated when a note's
  `meta` changes and rebuildable from note docs (ADR 002).
- Small settings may use `localStorage`.
- On startup, call `navigator.storage.persist()`; if not granted, show a non-blocking
  warning explaining the eviction risk.

Resolved question:
1. Hand-built component (ADR 001): the sync server is hand-built for learning; storage
   uses the ready-made `y-indexeddb` (option A).

## Consequences

- Persistence is per note doc; opening a note loads only that note's data.
- Cross-note search is unavailable until M6 (or a simple title-only filter on the list).
- `y-indexeddb` compaction means the local store is not a full edit log; version history
  needs its own storage design (future ADR).
- Unsynced notes can be lost if the browser evicts storage; whether unshared notes are
  backed up to the server is decided in the sync topology ADR.
- An "export note(s)" feature is a cheap extra safety net worth considering.
