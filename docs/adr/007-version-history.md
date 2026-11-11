# ADR 007: Version history

- **Status:** Accepted (2026-11-11)
- **Date:** 2026-11-11

## Context

The brief (M4) requires periodic snapshots, a history panel, preview, and restore that
syncs to collaborators.

Two constraints shape the design:

1. **Restore must be a forward edit.** In a CRDT, replicas cannot be rewound: other
   replicas still hold newer changes and would merge them back. Restoring therefore means
   applying a new change that makes the document match an earlier state (like `git revert`,
   not `git reset`). It syncs and is undoable like any edit.
2. **Yjs garbage-collects deleted content by default** (ADR 001), so earlier states cannot
   be reconstructed from the current document unless GC is disabled or copies are kept.

Every note syncs to the server (ADR 005), so the server sees all changes and is the natural
home for shared history. Access control follows ADR 006 roles.

## Options considered

### A. Yjs native snapshots with `gc: false`
A `Y.snapshot` (state vector + delete set) is tiny; old states are rebuilt with
`Y.createDocFromSnapshot`, which requires that nothing was garbage-collected.
- Pros: near-free snapshots, so very frequent; enables author-coloured diffs
  (`y-prosemirror` snapshot rendering; BlockNote support unverified).
- Cons: documents retain all deleted content forever and grow, which hurts load time and
  memory on large documents (M5); every client and the server must have GC off, a fragile
  invariant.
- Right when: fine-grained attributed diffs matter and documents stay small.

### B. Full-state snapshots stored by the server
The server periodically stores `Y.encodeStateAsUpdate(doc)` as a timestamped blob.
- Pros: simple; snapshots are independent; GC stays on; easy retention/pruning; a few
  lines in the hand-built server (ADR 005).
- Cons: more storage (each snapshot is the whole note, typically tens to hundreds of KB
  for text); only captured moments are restorable; attributed diffs need extra work.
- Right when: reliable whole-version restore (the brief's requirement).

### C. Append-only update log on the server
- Pros: every moment recoverable; audit trail.
- Cons: storage grows per keystroke; replay is slow without checkpoints (becomes B + log);
  conflicts with ADR 005's single compacted state per note.
- Right when: audit/compliance or replay features.

### D. Client-only history (IndexedDB)
- Pros: works offline.
- Cons: diverges per user; lost on eviction; not trustworthy across collaborators.
- Right when: single-user offline apps.

## Decision

**B**.

- **Capture:** the server snapshots a note at most every 10 minutes while it is being
  edited, and when the last connection leaves its room. No snapshot if unchanged since the
  previous one.
- **Storage:** SQLite table `snapshots(id, note_id, created_at, kind, name, state)` where
  `kind` is `auto`, `named` or `pre-restore`.
- **Retention:** keep all `auto` snapshots for 7 days, then one per day for 90 days, then
  delete. `named` snapshots are kept forever. Tunable.
- **API:** HTTP endpoints to list snapshots and fetch one, authorised by token (ADR 006).
- **Preview:** load the snapshot into a temporary `Y.Doc` and render it in a read-only
  editor.
- **Restore:** a forward edit. The client takes the snapshot's blocks and replaces the
  live note's content via BlockNote, so it syncs and is undoable. The server records a
  `pre-restore` snapshot first, so a restore can itself be reverted.

Resolved questions (owner delegated to the recommendations):
1. Whole-version preview and restore (B); attributed coloured diffs are a possible later
   exploration.
2. Named versions ("Save version", kept forever) are included.
3. `owner` and `edit` can view and restore history; `view` cannot see history.

## Consequences

- History requires a connection to the server; the history panel is unavailable offline.
- Server storage grows with snapshots; retention pruning is a scheduled server task.
- Concurrent edits during a restore merge normally; text typed inside a replaced region
  may disappear. This is undoable and must be covered by an M4 test.
- Snapshots taken from compacted, GC'd state cannot show who wrote what; attribution
  needs a separate design if wanted later.
- Restore replaces blocks via the BlockNote API, which ties the restore path to
  BlockNote's block schema (ADR 003).
