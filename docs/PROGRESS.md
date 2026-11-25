# Progress

## Current phase
**Phase 5a: Accessibility (M5a): in progress** (started 2026-11-25, approved by the owner
ahead of Phase 3). Phases 0-2 and T19 complete.

## Next action
T62: keyboard and focus (skip link, focus on navigation, dialogs and popovers return focus).

## Task status

| Phase | ID | Task | Status |
|---|---|---|---|
| 0 | T01 | Workspace root | done |
| 0 | T02 | Strict TypeScript + shared package | done |
| 0 | T03 | Server skeleton + Vitest | done |
| 0 | T04 | Web skeleton + Playwright | done |
| 0 | T05 | Lint and format | done |
| 0 | T07 | README stub + learning log | done |
| 1 | T10 | M1 acceptance test | done |
| 1 | T11 | Note docs + local persistence + editor | done |
| 1 | T12 | Note list cache | done |
| 1 | T13 | Local delete | done |
| 1 | T14 | Offline app shell | done |
| 1 | T15 | Persistent storage | done |
| 1 | T16 | Safe links | done |
| 1 | T17 | Schema gate | done |
| 1 | T18 | Close M1 | done |
| 1 | T19 | Visual design baseline | done |
| 2 | S20 | Spike: tabs + unknown blocks | done |
| 2 | T21 | M2 acceptance test | done |
| 2 | T22 | Single origin | done |
| 2 | T23 | Database + migrations | done |
| 2 | T24 | Rooms + sync relay | done |
| 2 | T25 | Room robustness | done |
| 2 | T26 | Persistence | done |
| 2 | T27 | Save acknowledgement | done |
| 2 | T28 | Connect-time auth | done |
| 2 | T29 | Role filter | done |
| 2 | T30 | Limits | done |
| 2 | T31 | Token REST API | done |
| 2 | T32 | Client sync wiring | done |
| 2 | T33 | Presence | done |
| 2 | T34 | Share dialog + link opening | done |
| 2 | T35 | View-only client | done |
| 2 | T36 | Tabs | done |
| 2 | T37 | Security headers | done |
| 2 | T38 | Close M2 | done |
| 3 | S40 | Spike: offline WebSockets in Playwright | todo |
| 3 | T41 | M3 acceptance test | todo |
| 3 | T42 | Network control helper | todo |
| 3 | T43 | Delete for everyone | todo |
| 3 | T44 | Stranded edits | todo |
| 3 | T45 | Convergence property test | todo |
| 3 | T46 | Known-loss characterisation | todo |
| 3 | T47 | Close M3 | todo |
| 4 | T50 | M4 acceptance test | todo |
| 4 | T51 | Retention policy | todo |
| 4 | T52 | Snapshot scheduler | todo |
| 4 | T53 | History API | todo |
| 4 | T54 | History panel | todo |
| 4 | T55 | Restore | todo |
| 4 | T56 | Close M4 | todo |
| 5a | T60 | M5a acceptance test | done |
| 5a | T61 | Accessibility scans + fixes | done |
| 5a | T62 | Keyboard and focus | todo |
| 5a | T63 | Screen-reader semantics | todo |
| 5a | T64 | Manual audit | todo |
| 5a | T65 | Close M5a | todo |
| 5b | T66 | Performance baseline | todo |
| 5b | T67 | Performance budgets + optimisation | todo |
| 6 | T70 | CI checks | todo |
| 6 | T71 | Nightly cross-browser | todo |
| 6 | T72 | Stability gate in CI | todo |

Statuses: `todo`, `in-progress` (with notes below), `done` (verification passed), `blocked`.

## Decisions log
- 2026-11-11: ADRs 001-007 accepted: Yjs; one doc per note with local note-list cache;
  BlockNote (no media blocks); `y-indexeddb`; hand-built WebSocket relay server, all notes
  sync; hashed role tokens (owner/edit/view), recovery deferred; server full-state snapshots
  with forward restore and named versions.
- 2026-11-12: ADRs 008-012 accepted: pnpm monorepo, strict TS, React + Vite, PWA shell;
  testing; local-only deployment; security baseline; additive-only schema evolution.
- 2026-11-12: Amendments: save `ack` after durable save (ADR 005); background sync queue
  deferred, "not backed up yet" marker instead (ADR 005); WebSocket tickets rejected and
  stranded-edits "save as new note" added (ADR 006); message limit ≥ document limit
  (ADR 011); integration/e2e-first TDD with minimal unit tests (ADR 009); no deployment
  planned (ADR 010).
- 2026-11-12: Plan decisions: owner does not write tests; M3 stability gate is 5
  consecutive passes. Execution plan approved ("modify as we go").
- 2026-11-12: Toolchain pinned: Node 26.13.1 (current Active LTS), pnpm 12.18.0.
- 2026-11-20: CI moved to the end (Phase 6: T70-T72); local `pnpm check` is the gate
  until then. Former T06 removed from Phase 0.
- 2026-11-12: TypeScript pinned to ~6.0.3, not 7.x: typescript-eslint (type-checked lint,
  ADR 008) supports only `<6.1`. Revisit when it supports TypeScript 7.

- 2026-11-20: Phase 1 plan approved. Playwright `actionTimeout`/`navigationTimeout` set to
  10 s (a timeout is not a failure, so it would break `test.fail()`).
- 2026-11-20: `exactOptionalPropertyTypes` turned off for `apps/web` browser code only:
  BlockNote 0.57's types do not compile with it (even its default editor type). Still on
  for server and shared code. ESLint `no-unused-vars` allows `ignoreRestSiblings`.
- 2026-11-20: BlockNote collaboration via `@blocknote/core/yjs` (Yjs 13 + `y-prosemirror`),
  not `@blocknote/core/y` (Yjs 14 release candidate); `y-indexeddb` needs Yjs 13.
- 2026-11-20: Owner: implement a whole approved phase without asking between tasks.
- 2026-11-20: `meta.updatedAt` added (additive, ADR 012) so "most recent first" survives a
  list rebuild; refreshed at most every 10 s of local editing.
- 2026-11-20: e2e builds use `vite build --mode test`, which installs `window.__driftnote`
  test hooks (`src/testHooks.ts`); normal builds drop them.
- 2026-11-20: `@M1-done` switched to a normal test in T14 (the task that made it pass),
  not T18; execution plan's rule updated: switch in whichever task makes it pass.
- 2026-11-20: e2e tests block service workers by default (`serviceWorkers: "block"`);
  offline tests opt in. Each context otherwise downloaded the ~5 MB precache.
- 2026-11-20: Owner: the UI must be professional and beautiful, now and in every later
  task. Design system in `docs/DESIGN.md`: plain CSS with design tokens (no CSS framework),
  light/dark from the OS, Inter, inline SVG icons, two-pane layout; `pnpm shots` for
  visual review. ESLint `no-confusing-void-expression` allows arrow shorthand
  (`onClick={() => setOpen(false)}`).
- 2026-11-21: SQLite via `better-sqlite3` 13 (ADR 008 rule: built-in `node:sqlite` only if
  stable). Node 26 docs mark `node:sqlite` "1.2 Release candidate" (and just renamed
  `DatabaseSync` to `Database`). `better-sqlite3` ships prebuilt Node-API binaries, so no
  install script runs. All access goes through `src/db/database.ts` for an easy switch later.
- 2026-11-21: SQLite settings: WAL, `synchronous=FULL` (the `ack` means "on disk"),
  `foreign_keys=ON`. In T28 the owner claim must create the `notes` row (empty state) before
  the token row, because `tokens.note_id` references `notes`.
- 2026-11-21: Server timers are injected (`src/sync/timers.ts`); tests drive a manual clock
  (`test/support/manualTimers.ts`) instead of faking global timers, which would also freeze
  the timers inside `ws` and Yjs. Any incoming traffic counts as liveness, not only pongs.
- 2026-11-21: `ack` = message type 100 + an encoded Yjs snapshot (state vector + delete
  set) of the state just saved. Coverage: every local insert count ≤ the ack's and every
  locally deleted range inside the ack's delete set. Also sent on join when the room has
  nothing unsaved.
- 2026-11-21: Tokens are 43-char nanoids (~256 bits, `createToken` in shared); only
  well-formed tokens may claim a new note as owner. Refusals: accept the WebSocket, then
  close with the code (browsers cannot read why an upgrade failed).
- 2026-11-21: Share-link tokens are generated by the server (the owner token by the
  browser, so notes can exist offline). The owner's own token is never listed or revocable
  through the API; owners are never minted through it.
- 2026-11-21: Tokens, roles and the "not backed up" flag live in a separate IndexedDB
  database `driftnote-access` (never dropped), not in the note-list cache.
- 2026-11-21: T34 done before T33 (T33's test needs two people in one note, which needs
  share links). `@M2-done` switched to a normal test in T34, which made it pass.
- 2026-11-21: New endpoint `GET /api/notes/:id/role` (any valid token → `{ role }`), so a
  browser that opened a link learns its role from the server, not from the (editable) link.
- 2026-11-21: Presence: a connection may only send presence for client IDs it introduced
  (server filters awareness entries); others' cursors cannot be overwritten. A joining
  client is sent everyone's presence only after its sync step 2 reply (content first):
  cursors that arrive before their content make BlockNote's cursor plugin throw and stop
  rendering.
- 2026-11-21: CSP allows inline *styles* (`style-src 'self' 'unsafe-inline'`): Mantine
  injects a <style> tag and cursors/avatars use style attributes. Scripts stay `'self'`.
  HSTS only over TLS or with `TRUST_PROXY=1` and `X-Forwarded-Proto: https`.

- 2026-11-25: Owner: do accessibility now, before Phase 3; performance stays after M4.
  Phase 5 split into 5a Accessibility (T60-T65) and 5b Performance (T66-T67, formerly
  T62-T63). Standard: WCAG 2.2 AA via axe tags; third-party violations we cannot fix are
  recorded in `docs/ACCESSIBILITY.md`, never silently excluded. From M5a on, every UI
  task runs the axe check and keeps the keyboard flow working.

## Open questions
- Suspected editor race (not confirmed): a cursor-only key press (End) by one person was
  repeatedly lost in the recorded demo when another person moved their cursor at the
  same instant; not reproduced in isolation (End worked with a remote cursor present;
  concurrent typing is correct, see `m2-collab`). Revisit in M5a (keyboard work).
- To answer by spike: Playwright offline emulation of WebSockets (S40). Also for S40: a
  rare WebKit failure (1 in ~200 runs) of "a note page loads offline, even when opened
  directly": `FetchEvent.respondWith received an error: TypeError: Load failed`, i.e. the
  service worker hit the network during an offline navigation.
- **Owner decision needed:** ADR 012 amendment (Proposed): every `schemaVersion` bump also
  bumps `PROTOCOL_VERSION`, so the server refuses outdated clients that would delete
  unknown blocks (S20 finding). Not urgent: no block types are added before then.
- Leaving a note right after editing leaves it "Not backed up" until it is reopened online
  (only open notes sync, ADR 005). Cheap improvement to consider: keep the connection open a
  few seconds after leaving, until the save is acknowledged.
- Bundle size: main JS chunk is 1.4 MB (440 kB gzipped), mostly BlockNote, plus ~25 locale
  chunks. The PWA precache is 4.9 MB (39 files), ~3 MB of it emoji names in 25 languages (loaded lazily by the
  emoji picker);
  optimise in M5b (T67).

## In-progress notes
None.

## Handoff note
Architecture discussion finished: 12 accepted ADRs and `docs/ARCHITECTURE.md`. Execution
plan approved; the owner expects the plan to be adjusted as we go. Phase 0 approved.
T01 done: Node 26.13.1 (`.nvmrc`; run `nvm use` in the repo, the machine default stays
Node 18) and pnpm 12.18.0 (installed globally with npm). `minimumReleaseAge` (3 days) is
set in `pnpm-workspace.yaml`.
T02 done: `tsconfig.base.json` (strict + extra flags, `noEmit`, Bundler resolution);
`packages/shared` exports TS source and has no DOM/Node types (verified: using `document`
or `process` there fails `pnpm typecheck`).
T03 done: `apps/sync-server` (`startServer({ port })` on `node:http`, `GET /healthz`, run
with `tsx`); root `vitest.config.ts` with `unit` and `integration` projects; scripts
`test`, `test:unit`, `test:int`. pnpm blocks dependency install scripts; only `esbuild` is
allowed (`allowBuilds` in `pnpm-workspace.yaml`).
T04 done: `apps/web` (Vite 8 + React 19; `tsconfig.json` for browser code,
`tsconfig.node.json` for configs and e2e). Playwright 1.65 builds the app, serves it with
`vite preview` on 4173 and starts the sync server on 4100; projects chromium/firefox/webkit
(only Chromium is installed locally so far). Root `pnpm e2e` / `pnpm e2e:all` forward
extra args (e.g. `--grep @M0`).
T05 done: ESLint 10 flat config (`strictTypeChecked` + `stylisticTypeChecked`, React hooks
rules for web code, Prettier compat); Prettier (width 100; Markdown excluded so docs are
not reformatted). Root `tsconfig.json` covers root config files; `apps/web/tsconfig.json`
is a solution file referencing `tsconfig.app.json` and `tsconfig.node.json`. `pnpm check`
runs everything and is green.
CI moved to Phase 6; the unpushed CI commit was dropped from local history with the owner's
permission (2026-11-20).
T07 done: `README.md` (run locally in three commands, checks, layout, doc links),
`docs/LEARNING_LOG.md` (first entries), root `pnpm dev` runs server and web together.
T10 done: `apps/web/e2e/m1-offline.spec.ts` (`@M1-done`, `test.fail()`). UI contract it
fixes: a "New note" button on `/`; editor wrapper `data-testid="note-editor"` with
`data-local-state="saved"` once the change is in IndexedDB; the URL stays the note URL.
T11 done: `@driftnote/shared` exports `createNoteId`/`isNoteId` (nanoid, 21 chars) and
doc constants (`content`, `meta`, `NOTE_SCHEMA_VERSION = 1`). Web: `src/notes/noteDoc.ts`
(`OpenNote`: Y.Doc + `y-indexeddb`, `localState` tracked with a read-only IndexedDB
"barrier" transaction after each update), `createNote.ts` (writes `meta`, waits for save),
`schema.ts` (no audio/file/image/video), React Router routes `/` and `/n/:noteId`.
Tests: `e2e/editor.spec.ts` (reload keeps content; two notes separate; no media in slash
menu, verified to fail when media blocks are restored). `@M1-done` now fails at the
offline reload (`ERR_INTERNET_DISCONNECTED`), as expected until T14.
T12 done: `src/notes/noteList.ts` (`idb` database `driftnote`, store `notes` with
`updatedAt` index; dropped and rebuilt from note databases found via
`indexedDB.databases()` when new or outdated); title input (`NoteTitle`, bound to
`meta.title`); home page list (`<ul aria-label="Notes">`, "Untitled" fallback). Test hook
`clearNoteList()`. e2e helpers in `e2e/support/notes.ts`. Tests `e2e/note-list.spec.ts`;
the rebuild test verified to fail with the rebuild disabled.
T13 done: "Delete note" → in-page confirm ("Yes, delete" / "Cancel") → removes list entry
and the note's database (`OpenNote.deleteLocal`). `NotePage` checks the ID shape and that
the database exists before opening (opening would create it); otherwise "Note not found".
Tests `e2e/delete.spec.ts`.
T14 done: `vite-plugin-pwa` 2 (`registerType: "prompt"`, `clientsClaim`, navigate fallback
to `/index.html` except `/api/`, `/sync/`, `/healthz`); `src/UpdatePrompt.tsx` ("new
version" banner with Reload/Later). e2e helper `waitForOfflineReady` (service worker active
and controlling). Tests `e2e/offline-shell.spec.ts`; `@M1-done` now passes and is a normal
test.
T15 done: `src/storage/persistentStorage.ts` (ask once; skip if already persistent) and
`StorageWarning` (`role="alert"` banner when refused or unsupported). Tests
`e2e/persistent-storage.spec.ts` stub `navigator.storage` with `addInitScript`.
T16 done: `src/notes/safeLinks.ts` (`isSafeLinkHref`: `URL`-parsed scheme in
http/https/mailto; `openLinkSafely`: opens only safe links with `noopener`), passed to
BlockNote as `links.isValidLink` / `links.onClick`; `NoteEditor.css` shows emptied links as
plain text. Test hook `injectLink(text, href)` edits the Yjs fragment directly (like a
remote update); `src/notes/currentNote.ts` tracks the open note for hooks. Each defence
verified by removing it (ftp link kept its address; clicks opened two tabs).
T17 done: `OpenNote.isEditable` (`meta.schemaVersion` ≤ `NOTE_SCHEMA_VERSION`);
`useNoteEditable` hook; editor `editable={false}`, title `readOnly`, `SchemaGateNotice`
(`role="alert"`); the `updatedAt` refresh never writes to a gated note; delete still
allowed. Test hook `setSchemaVersion(v)`. Tests `e2e/schema-gate.spec.ts`. `editorBody`
helper now targets `.bn-editor` (BlockNote's trailing-block widget is contenteditable too).
T18 done: Playwright Firefox and WebKit installed locally. `pnpm e2e:all --grep @M1`: 63/63,
and 189/189 with `--repeat-each=3`. WebKit fix: storage stubs patch
`StorageManager.prototype` (WebKit recreated the `navigator.storage` wrapper, dropping
properties set on it). M1 complete.
T19 done (owner request after M1): `src/styles/tokens.css` + `base.css`; `AppShell`
(sidebar + content, one pane under 768px), `Sidebar` (brand h1, New note, live note list
via `subscribeToNoteList`, relative times, storage notice), `EmptyState`, restyled note
page (sticky toolbar with `SaveStatus` and delete popover, 40px title, BlockNote themed via
its CSS variables, heading scale 28/22/19px), `UpdatePrompt` toast, logo + favicon.
`HomePage.tsx` removed (its parts moved into the shell). `pnpm shots` →
`apps/web/screenshots/` (git-ignored). All e2e unchanged and green in 3 browsers.
S20 done: learning-log entry. (1) `y-websocket` keeps offline tabs in sync through
`BroadcastChannel` unless `disconnect()` is called. (2) `y-prosemirror` deletes unknown
block types from the Yjs doc on render, even when not editable; unknown attributes are
kept. ADR 012 amendment proposed (not accepted). No spike code committed.
T17 fix (after S20): a gated note's editor is bound to a disposable copy
(`OpenNote.createReadOnlyCopy` + `forwardUpdatesTo`, one-way), so the editor's deletion of
unknown blocks never reaches storage. Test hooks `injectBlock(type, text)` and
`storedContent()`; regression test in `e2e/schema-gate.spec.ts`.
T21 done: `e2e/m2-collab.spec.ts` (`@M2-done`, `test.fail()`), two browser contexts as two
users. UI contract: "Share" button → "Create edit link" → link in textbox "Edit link";
opening it in another context joins the note. Fails at the Share button, as expected.
T22 done: `apps/sync-server/src/static.ts` serves `STATIC_DIR` (real files; `index.html`
for extension-less paths; 404 for missing files with an extension; never `/api`, `/sync`,
`/healthz`; percent-decoded path must stay inside the root). Caching: `/assets/*`
immutable, everything else `no-cache`. Unknown routes return JSON 404. Playwright now runs
one server (build in test mode, then sync server with `STATIC_DIR`, port 4100). Vite dev
proxies `/api`, `/healthz`, `/sync` (ws) to :4000. Traversal test sends raw paths with
`node:http` and was verified to fail when the containment check is removed.
T23 done: `src/db/database.ts` (`openDatabase(path)`: pragmas + forward-only migrations, each
file in its own transaction with its `schema_migrations` row), `src/db/migrations/
001_initial.sql` (notes, tokens, tombstones, snapshots; CHECK constraints on role/kind).
Server option `databasePath` (default `:memory:`), env `DATABASE_PATH` (default
`data/driftnote.sqlite`); Playwright uses a fresh temp file per run. Tests `test/db.int.test.ts`.
T24 done: `src/sync/room.ts` (`Room`: Y.Doc + Awareness + connections; sync step 1 on join;
`readSyncMessage` with the socket as origin; the doc's update event forwards to all but the
origin; presence IDs tracked per connection and removed on close) and
`src/sync/syncEndpoint.ts` (`ws` in `noServer` mode on HTTP upgrade; `/sync/<noteId>` with
`isNoteId` check, else 404; malformed message closes only that socket with 1003). Shared
`MESSAGE_SYNC = 0`, `MESSAGE_AWARENESS = 1`. Test clients (`test/support/clients.ts`) are
real `y-websocket` providers with `disableBc: true`. Tests `test/rooms.int.test.ts`
(presence cleanup verified by sabotage). Auth still open (T28); no persistence yet (T26).
T25 done: `SyncEndpoint` options `loadNote`, `timers`, `unloadGraceMs` (30 s),
`pingIntervalMs` (30 s), `maxBufferedBytes` (64 MB, close 1013). Shared `loading` map
(one load per note); per-connection message queue until the room is ready; empty rooms
unload after the grace period, a join cancels it; ping sweep terminates sockets silent
since the last ping. Tests `test/room-lifecycle.int.test.ts` (dead socket = raw `ws`
client with `autoPong: false`); queue verified by sabotage. Slow-consumer close has no
test yet (hard to provoke deterministically).
T26 done: `src/db/notesStore.ts` (load; upsert whole state + schema_version). Rooms load
from SQLite on open (origin `storage`, not marked dirty); any other change sets `dirty` and
schedules a save `saveDebounceMs` (2 s) after the first unsaved change (not reset by later
edits); unload and shutdown save first; a failed save re-marks dirty and retries. `dirty`
cleared before encoding. Env overrides: `SAVE_DEBOUNCE_MS`, `UNLOAD_GRACE_MS`,
`PING_INTERVAL_MS`. Tests `test/persistence.int.test.ts` (restart, continuous typing, every
client's changes, unload saves); the no-postpone rule verified by sabotage.
T27 done: `@driftnote/shared` `ack.ts` (`MESSAGE_ACK = 100`, `encodeAckMessage`,
`decodeAckMessage`, `ackCovers`; shared now depends on `yjs` and `lib0`). Server: state and
ack encoded in one synchronous step, ack broadcast only after `saveNote` returns; failed
save sends nothing and retries. Unit tests `packages/shared/src/ack.test.ts` (delete-only
case verified by sabotage); integration `test/ack.int.test.ts` (failed-save test uses a
message barrier; verified by sabotage). Test clients record acks.
T28 done: `src/db/tokensStore.ts` (SHA-256 `hashToken`; `find` active grant; `noteExists`;
`isDeleted`; `claimOwner` inserts the empty `notes` row then the owner token in one
transaction), `src/sync/auth.ts` (`authorize`: pv → 4426, tombstone → 4410, token grant,
owner claim for unknown note with a well-formed token, else 4401; a token that already owns
another note is refused, not a crash). Connections carry `tokenId` and `role`. Shared: close
code constants, `createToken`, `isWellFormedToken`, `Role`. Test clients use one owner token
per note (`defaultTokenFor`). Tests `test/auth.int.test.ts` (DB files incl. WAL scanned for
token text; logs captured; plaintext storage verified to fail by sabotage).
T29 done: `Room.receiveSync` reads the sync subtype: step 1 answered for every role; step 2
and updates applied only for owner/edit (view: dropped silently; unknown subtype throws →
socket closed 1003). Tests `test/roles.int.test.ts`: all 12 role × message cases with raw
`ws` sockets and hand-built messages (awareness barrier for "dropped"), viewer receives live
edits, viewer's local edits reach nobody.
T30 done: `src/sync/limits.ts` (`DEFAULT_LIMITS`: document 20 MB, message 24 MB, 60
updates/s with burst 200, 50 connections per IP; `TokenBucket`; `LimitError` with close
code). Message size checked before handling (4413); `ws` `maxPayload` = 2 × limit as a
memory net only (its own close code is 1009). Room checks rate and size *before* applying a
change; size uses a running upper-bound estimate (exact after save/load) and re-encodes
only when near the limit. Per-IP count at upgrade (4429). `Timers.now()` added. Tests
`test/limits.int.test.ts` (legal 50 KB catch-up accepted; apply-before-check verified to
fail by sabotage).
T31 done: `src/api/http.ts` (JSON helpers, bearer token, 4 KB JSON body limit) and
`src/api/tokensApi.ts` (owner-only `POST`/`GET`/`DELETE /api/notes/:id/tokens[/:tokenId]`;
role resolved like the handshake: 404 bad/unknown note, 410 tombstone, 401 token, 403 role;
400 bad role; revoke sets `revoked_at` and `SyncEndpoint.disconnectToken` closes live
sockets with 4401). `TokensStore`: `createLink`, `listLinksOf` (no owner row, no hashes),
`revoke`. Tests `test/tokens-api.int.test.ts`; disconnect-on-revoke verified by sabotage.
T32 done: `src/notes/access.ts` (DB `driftnote-access`: token, role, `unsynced`, `syncedAt`;
`ensureAccess` creates an owner token for notes without one), `src/notes/changes.ts`
(shared change events), `src/sync/noteSync.ts` (`NoteSync`: `y-websocket` provider on
`ws(s)://<host>/sync/<id>?t=&pv=`, BroadcastChannel kept for tabs; `shouldReconnect` false
for 4401/4410/4413/4426 → state `stopped`; ack handler at `MESSAGE_ACK`; states offline /
syncing / synced from `wsconnected` + `ackCovers`; local changes mark `unsynced`), badge
`SyncStatus` (`data-testid="sync-status"`, `data-sync-state`; replaced `SaveStatus`),
sidebar "Not backed up" marker. e2e helper `controlSyncNetwork` (Playwright
`routeWebSocket` block/unblock); e2e server `SAVE_DEBOUNCE_MS=300`. Tests `e2e/sync.spec.ts`;
offline screen added to `pnpm shots`.
T34 done: server `GET /api/notes/:id/role`. Web: `src/api/client.ts` (REST calls, `ApiError`
with status 0 = unreachable, `shareUrl` puts the token in the fragment);
`src/notes/openLink.ts` (`acceptLinkFromUrl`: read `#t`, scrub it with `replaceState`, fetch
role, store access unless the browser already owns the note); access DB v2 adds `links`
(owner keeps created tokens to copy again). `ShareDialog` (native `<dialog>` +
`showModal`; create/copy/revoke with confirm; disabled until connected); NotePage states
`invalid-link` and `link-offline`, `hashchange` re-runs link handling, Share button for
owners, `SyncStoppedNotice` for 4401/4410/4413/4426. Phone toolbar: `.toolbar-btn` icon-only
(scoped: dialogs render inside the toolbar). e2e fixture `bob` (`e2e/support/users.ts`),
helper `createShareLink`; tests `e2e/share.spec.ts`; `m2-collab` now a normal test.
T33 done: server `src/sync/awarenessFilter.ts` + ownership check in `Room` (entries for IDs
owned by another connection dropped); presence sent once per connection after its first
step-1 reply (`sendPresenceOnce`). Web: `src/presence/identity.ts` (name + colour in
`localStorage`, friendly random default, `useIdentity` syncs across tabs),
`ProfileButton` ("You: <name>" in the sidebar footer; dialog "How others see you"),
`PeopleHere` (avatars from awareness, `aria-label="People here"`), `Avatar`; editor's
`CollaborationExtension` gets the provider's awareness (not for gated read-only copies);
identity changes go straight to awareness. Tests `test/presence.int.test.ts` (spoofing,
content-before-cursors order), `e2e/presence.spec.ts`; screens 10 (presence), 11 (profile).
T35 done: `OpenNote.setRole`; `isEditable` = supported schema and not a viewer;
`isSchemaSupported` (used by `SchemaGateNotice`, `useSchemaSupported`). Viewers: editor
bound to the read-only copy, title read-only, no `updatedAt` writes, "View only" chip.
Cursors now shown on read-only copies too (positions are Yjs item IDs; T17's note was
wrong). Tests `e2e/view-only.spec.ts` (injected change never reaches the owner; barrier =
viewer's name change). Screen 12 (view only). For T43: "Delete note" for a non-owner only
removes the note from this browser; label it accordingly.
T36 done: no code change needed: `y-websocket`'s BroadcastChannel (kept on in T32) syncs
tabs while the server is unreachable, as S20 predicted. `e2e/tabs.spec.ts` (two pages in
one context, all sync sockets closed via `context.routeWebSocket`) passed at once and was
verified by sabotage (`disableBc: true` makes it fail). Confirms S20's caveat in a real
browser.
T37 done: `apps/sync-server/src/securityHeaders.ts` on every HTTP response: CSP
(`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`,
`frame-ancestors 'none'`, ...), `Referrer-Policy: no-referrer`, `X-Content-Type-Options:
nosniff`, HSTS when HTTPS (TLS socket, or trusted proxy via `trustProxy` / env
`TRUST_PROXY=1`). Tests `test/headers.int.test.ts`, `e2e/csp.spec.ts` (main flows record
zero `securitypolicyviolation` events; an injected inline script is blocked); verified by
sabotage. Whole e2e suite green in all three browsers under the policy.
Fix after T37 (gap found while explaining the sync code): revoking a link also closes
connections that passed auth but were still waiting for their note to load
(`SyncEndpoint.waiting`, `pendingConnections`); they never join. Test in
`test/tokens-api.int.test.ts`, verified by sabotage.
T38 done: `pnpm check` green; `pnpm e2e:all --grep "@M1|@M2"` 114/114. Tests with a
second person (`bob` fixture) get double the total test budget (a loaded machine made
Firefox exceed 30 s; per-step limits unchanged); `m2-collab` uses the fixture. M2 complete.
README showcase (owner request, 2026-11-23): `pnpm demo` records the README media with
Chromium's screencast (`e2e/visual/recorder.ts`) and encodes GIFs in-repo with `gifenc` +
`pngjs` (`e2e/visual/gif.ts`; side-by-side windows, preview PNGs in
`apps/web/screenshots/demo/` for review); demos assert their own result. Output in
`docs/media/` (offline.gif, collaboration.gif, app-light.png, app-dark.png). README
rewritten. New `@M2` test: two people typing at the same moment each keep their place.
`controlSyncNetwork` now also closes open sync sockets on `block()` and accepts a context.
T60 done (Phase 5a): `@axe-core/playwright` 4.14 (axe-core 4.14.1). Helpers
`e2e/support/a11y.ts` (`expectAccessible(page, screen)`: WCAG 2.2 A/AA tags, readable
list of violations) and `e2e/support/keyboard.ts` (`tabTo`: Tab/Shift+Tab only, lists the
focus path when the target is never reached; `expectFocusVisible`: not on <body> and
`:focus-visible`). `e2e/m5a-accessibility.spec.ts` (`@M5a-done`, `test.fail()`): keyboard-only
create → title → Enter to text → share (Escape returns focus to Share) → second note →
open first from the list (focus on its title) → rename → delete (focus on Cancel, not lost
afterwards), axe on each screen. UI contract it fixes: opening a note focuses its title;
Enter in the title moves to the text. Fails first on a real violation: contrast of the
"You" caption in the sidebar footer. Expected failure in all three browsers.
T61 done: `e2e/a11y-scans.spec.ts` scans 20 screens/states × light/dark × desktop/phone
(soft assertions, so one run lists every problem); green in Chromium, Firefox, WebKit.
`expectAccessible` now waits for finite animations first (mid-fade text was measured at a
fraction of its colour) and supports narrow, documented exceptions (one: axe's
`scrollable-region-focusable` on BlockNote's slash menu, backed by a keyboard test).
Fixes: `--text-faint`/`--text-muted` darkened (light) and lightened (dark) to ≥ 4.5:1 on
every surface; `--on-danger` (dark text on the dark-mode danger fill); three presence
colours deepened, old values migrated on load; avatar initials pick white/dark by contrast
(`lib/contrast.ts`, any remote colour); editor `aria-label="Note text"` via
`domAttributes`; `notes/editorAria.ts` removes BlockNote's invalid `aria-expanded` on the
textbox and names the slash menu "Insert a block"; inline links get 3px block padding
(24px targets; WebKit's box is 0.6px shorter than Chromium's); on phones the update prompt
is a grid row, not a floating card (it covered the profile button: WCAG 2.4.11). Test hook
`showUpdatePrompt()`; screenshot 13 (update prompt). `docs/ACCESSIBILITY.md` (standard,
checks, repairs, exceptions, limitations). Each fix verified by sabotage. README GIFs not
re-recorded yet (colours changed slightly): do it in T65 after all M5a UI changes.
