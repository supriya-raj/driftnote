# Driftnote

A local-first, real-time collaborative notes app. It works fully offline, syncs when a connection returns, and merges concurrent edits without conflicts.

## Why I'm building this
This is a learning project. I want to understand how local-first software works in practice: CRDTs, offline storage, sync, and real-time collaboration. The goal is to learn by building, make mistakes, and write down what I find along the way.

## What I want to learn
- How CRDTs (via Yjs) resolve concurrent edits, and how that differs from operational transform
- How to design for offline-first: storage choices, sync cost, schema evolution
- How a block-based rich-text editor (BlockNote) binds to a CRDT, and enough of the layers underneath (TipTap, ProseMirror, `contenteditable`) to debug it
- How to test real-time, multi-user, and flaky-network behavior
- How to profile and improve performance on large documents
- How to make a complex editing UI accessible
- The privacy and security implications of syncing user data

## Core features
1. Create, edit, rename, and delete notes in a rich-text editor with no account and no network.
2. Notes persist locally across reloads and browser restarts.
3. Share a note by link so others can edit it in real time.
4. See collaborators' cursors and names (presence).
5. Edit offline, then reconnect and merge with others' changes without data loss.
6. A visible connection status (offline / syncing / synced).
7. Version history with the ability to restore a previous version.

## Stack
Decided in `docs/adr/` (reasons and trade-offs there); system design in `docs/ARCHITECTURE.md`.

- **Monorepo:** pnpm workspaces: `apps/web`, `apps/sync-server`, `packages/shared`
- **Frontend:** React + TypeScript (strict) + Vite, offline app shell via a service worker
- **Editor:** BlockNote (on TipTap/ProseMirror) with Yjs collaboration
- **CRDT:** Yjs, one document per note
- **Local persistence:** IndexedDB (`y-indexeddb`)
- **Sync server:** hand-built Node WebSocket relay (Yjs wire format) with SQLite
- **Sharing:** links carrying hashed, revocable owner/edit/view tokens
- **Testing:** Playwright (e2e, multi-user, offline) and Vitest (server integration, minimal unit)
- **CI:** GitHub Actions, added at the end; local checks first
- **Deployment:** none planned; runs locally

## Milestones

### M0: Setup
Monorepo, strict TypeScript, ESLint/Prettier, Vitest, Playwright, README stub.
**Done when:** all checks (`pnpm check`) pass locally on an empty app.

### M1: Single-user, offline-first editor
BlockNote editor, note list, create/rename/delete, persisted via `y-indexeddb`. Works with the network disabled.
**Done when:** a Playwright test creates a note, goes offline, reloads, and sees the note intact.

### M2: Real-time collaboration
Hand-built sync server, share links (edit/view), two browsers editing the same note, presence cursors with names and colors.
**Done when:** a Playwright test with two contexts shows both edits merged in both views.

### M3: Offline conflict handling
Offline edits from two users merge correctly on reconnect. Add a connection status indicator, plus tests that force offline, edit on both sides, then reconnect.
**Done when:** concurrent offline edits to the same paragraph are both preserved, and the test is stable (5 consecutive passes).

### M4: Version history
Server-side periodic snapshots, named versions, a history panel, preview, and restore.
**Done when:** a user can restore a note to an earlier state, and the restore syncs to collaborators.

### M5: Accessibility and performance
Keyboard navigation and screen-reader labels for the editor UI. Run an accessibility audit (axe plus a manual keyboard pass). Measure performance on large documents (10k+ words), then optimize and record the results.

### CI (final)
GitHub Actions running the same checks as `pnpm check`, plus nightly cross-browser e2e and
the M3 stability gate.
**Done when:** CI is green on `main`.

### M6: Explorations (optional, pick any)
- Move the note index and full-text search to SQLite-WASM on OPFS.
- Port the sync server to Cloudflare Durable Objects.
- Try end-to-end encryption, so the server only relays ciphertext.

### Deferred (not scheduled)
Recovery link and multi-device note list, background sync of unopened notes, coloured
"who changed what" diffs, image and file blocks, deployment.

## README
- One-sentence description and a short GIF of two windows editing, including an offline-to-online merge
- How to run locally in three commands
- Architecture diagram (client, local store, sync server)
- Tradeoffs and open questions
- Links to the ADRs and the learning log

