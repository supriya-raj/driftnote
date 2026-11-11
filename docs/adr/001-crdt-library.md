# ADR 001: CRDT library

- **Status:** Proposed
- **Date:** 2026-11-11

## Context

Driftnote must let multiple replicas (browser tabs, devices, collaborators) edit the same
note independently, including while offline for long periods, and merge without conflicts
or data loss. This calls for a CRDT (Conflict-free Replicated Data Type): a data structure
whose replicas converge to the same state once they have seen the same set of changes,
regardless of order, with no central referee.

The alternative family, Operational Transformation (OT), relies on a central server to
transform concurrent operations against each other. It works well online but poorly for
long offline sessions.

The chosen library constrains the editor binding, local persistence, sync protocol,
presence, and version history, so it is decided first.

## Options considered

### A. Yjs
JS CRDT with mutable shared types (`Y.Text`, `Y.Map`, `Y.Array`, `Y.XmlFragment`) and a
compact binary update format.
- Pros: largest ecosystem (`y-prosemirror` / TipTap Collaboration, `y-indexeddb`,
  Hocuspocus, `y-websocket`, awareness protocol for presence); very fast; small encoding;
  battle-tested.
- Cons: garbage-collects deleted content by default (`gc: true`), so reconstructing old
  versions requires `gc: false` or a separate snapshot strategy; low-level API;
  Yjs-specific binary format.
- Right when: you want proven rich-text editor integrations and an off-the-shelf sync stack.

### B. Automerge (v3)
Rust core compiled to WASM; JSON-like document model; retains full change history by default.
- Pros: built-in history and time travel (simplifies version history); `automerge-repo`
  bundles storage, network, sync; strong research pedigree.
- Cons: rich-text support is newer; `automerge-prosemirror` is less mature than
  `y-prosemirror`; TipTap's collaboration extensions are Yjs-only; WASM bundle size and
  build friction.
- Right when: history is the core feature, or data is mostly structured JSON.

### C. Loro
Newer Rust/WASM CRDT (1.0 in late 2024) using Fugue for text, with movable trees and built-in
version checkout.
- Pros: modern algorithms; fast; first-class history.
- Cons: young ecosystem; fewer editor/sync bindings; higher API-churn risk; less community help.
- Right when: you want the cutting edge and accept integration work.

### D. No CRDT: OT via ShareDB
- Pros: useful contrast for understanding OT.
- Cons: server-authoritative; poor fit for long offline editing, the app's core premise.
- Right when: online-only collaboration with a trusted central server.

## Decision

Proposed: **Yjs**. It is the only option where editor (TipTap), local persistence
(`y-indexeddb`), sync (Hocuspocus / `y-websocket`) and presence (awareness) integrate out of
the box, letting the project focus on understanding the mechanisms rather than writing glue.

## Consequences

- Version history (see a future ADR) must be designed deliberately: decide between
  `gc: false` + Yjs snapshots, or storing periodic full-state snapshots / update logs.
- Persisted and synced data uses the Yjs binary update format; switching CRDTs later
  would require a migration.
- Server and client must both use Yjs-compatible libraries (JS `yjs`, or `y-crdt`/Yrs ports).
- Optional learning follow-up: a small Automerge spike to compare models, recorded in the
  learning log.
