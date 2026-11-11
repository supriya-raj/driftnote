# ADR 005: Sync and server topology

- **Status:** Proposed
- **Date:** 2026-11-11

## Context

Each browser with a note open holds a replica of that note's `Y.Doc` (ADR 002). Sync must:

1. **Catch replicas up after time apart.** Yjs's sync protocol exchanges **state vectors**
   (a compact summary of how many changes have been seen from each client); each side then
   sends exactly the updates the other lacks (sync step 1 / step 2), followed by live
   updates. Because Yjs is a CRDT (ADR 001), delayed, duplicated or reordered messages
   still converge.
2. **Relay presence ("awareness").** Ephemeral per-connection state (name, colour, cursor)
   that is broadcast while connected and never persisted.

The brief requires offline editing that merges on reconnect, real-time collaboration on
shared notes, and presence (M2-M3). Per ADR 001 and ADR 004, the sync server is the
component hand-built for learning.

## Options considered

### A. Central relay server, hand-built (WebSocket, `y-protocols` wire format)
Clients connect over WebSocket; the server groups connections into rooms by note ID,
relays updates and awareness, and keeps its own copy of each note (an always-on peer).
- Pros: collaborators need not be online at the same time; matches the offline-merge
  story; small (~150-250 lines); using the standard `y-protocols` encoding lets clients
  use the stock `y-websocket` `WebsocketProvider`, which BlockNote supports.
- Cons: a server to run and maintain; server sees synced notes in plaintext (until the
  optional end-to-end encryption exploration).
- Right when: reliable asynchronous collaboration; the standard production topology.

### B. Hocuspocus (ready-made Yjs WebSocket server)
- Pros: production-ready; persistence and auth hooks; scaling options; good docs.
- Cons: hides the mechanism the project chose to learn.
- Right when: after a hand-built version, or when production features are needed fast.

### C. Peer-to-peer (`y-webrtc`)
- Pros: server never sees note content; minimal infrastructure (signalling only).
- Cons: syncs only while peers are online simultaneously, which breaks async offline
  merge; NAT traversal often needs a TURN relay anyway; poor scaling with many peers.
- Right when: synchronous sessions where privacy outweighs reliability.

### D. Hosted sync service (e.g. Liveblocks, Y-Sweet, PartyKit)
- Pros: no infrastructure; scales.
- Cons: hides everything; cost; vendor lock-in.
- Right when: shipping a product quickly. (Cloudflare Durable Objects, M6, is a middle
  ground: own logic on a managed platform.)

## Decision

Proposed: **A**.

- **Server:** Node + `ws` + `y-protocols` (sync and awareness message encoding). Hand-written:
  connection handling, rooms keyed by note ID, sync step 1/2 and update relay, awareness
  relay and cleanup on disconnect, persistence.
- **Server persistence:** a single SQLite file; one row per note
  (`note_id`, `state` as a merged Yjs update, `updated_at`), compacted on write or on a timer.
- **Client:** stock `y-websocket` `WebsocketProvider` (also syncs tabs within one browser via
  `BroadcastChannel`), alongside `y-indexeddb` (ADR 004).
- **Hocuspocus:** optional comparison exercise, recorded in the learning log.

Open questions (to be resolved before acceptance):
1. Do unshared notes sync to the server? Proposed: **no**; a note syncs only once shared.
   Mitigate local-loss risk with persistent-storage request (ADR 004) and an export feature.
2. Long term: keep the hand-built server or switch to Hocuspocus? Proposed: **keep it**;
   Hocuspocus only as a comparison.

## Consequences

- The server is a dumb relay: it cannot validate document content; any connected client
  can change any part of a note. Who may connect is decided in the sharing ADR.
- The server must be reachable on the internet for real sharing; deployment/hosting needs
  its own decision (added to the discussion roadmap).
- Server and client share the `y-protocols` wire format; message handling is a good target
  for unit tests (e.g. two in-memory clients through the server).
- Connection status (offline / syncing / synced, brief feature 6) is derived from the
  provider's connection and sync events.
- If unshared notes do not sync, an unshared note's only copy is in the browser.
