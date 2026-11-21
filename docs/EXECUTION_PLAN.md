# Driftnote: execution plan

Derived from `PROJECT_BRIEF.md`, the accepted ADRs (`docs/adr/`) and `docs/ARCHITECTURE.md`.
Progress is tracked in `docs/PROGRESS.md`.

## How every task is done (TDD)

1. **Red:** write the task's tests first; run them and show them failing.
2. **Green:** implement the minimum to pass.
3. **Refactor** with tests green.
4. Run the task's **Verify** check. A task is done only when it passes.
   **Any task that adds or changes UI** also follows `docs/DESIGN.md` and is checked
   visually with `pnpm shots` (light and dark, desktop and phone) before it is done.
5. Commit tests and code together: `feat(T23): ...` (conventional prefix, task ID). Update
   `docs/PROGRESS.md` in the same commit. Push.

**Test layers (ADR 009, amended):**
- **Integration** (Vitest, Node): the real sync server started in-process with real
  WebSocket clients and a temp SQLite file. Main layer for server behaviour.
  Files: `apps/sync-server/test/*.int.test.ts`.
- **E2E** (Playwright): real browsers against the real app and server; each browser context
  is a separate user. Main layer for anything user-visible.
  Files: `apps/web/e2e/*.spec.ts`, tagged by milestone in the title (`@M1`, `@M2`, ...).
- **Unit** (Vitest): only the snapshot retention policy and the `ack` coverage check.
- Each milestone starts with its **"done when" e2e test marked expected-to-fail**
  (`test.fail`), switched to a normal test in the milestone's final task, or earlier in
  whichever task makes it pass (an expected failure that passes turns the run red).

**Spikes** (`S` IDs) answer library-behaviour questions: time-boxed (≤ 2 hours), no TDD,
findings written to `docs/LEARNING_LOG.md`, spike code deleted (not committed).

**Re-runnability rules (apply to every task):**
- Check before creating: files, folders, dependencies, config, scripts. If it exists and
  matches the deliverable, leave it; if it differs, reconcile rather than recreate.
- Install dependencies with `pnpm add` (no-op if present); never hand-edit the lockfile.
- Database migrations are forward-only and recorded in `schema_migrations`; re-running is
  a no-op.
- Tests use temp directories, random ports and fresh browser contexts; no shared state
  between runs.
- An interrupted task is marked `in-progress` in `PROGRESS.md` with notes on what exists;
  resume by inspecting and finishing it.

**Standard commands** (created in Phase 0):

| Command | Runs |
|---|---|
| `pnpm lint` | ESLint (type-checked) |
| `pnpm format:check` | Prettier check |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm test` | All Vitest tests (unit + integration) |
| `pnpm test:int` | Sync-server integration tests |
| `pnpm e2e` | Playwright, Chromium (builds the app first) |
| `pnpm e2e:all` | Playwright, Chromium + Firefox + WebKit |
| `pnpm check` | lint + format:check + typecheck + test + e2e |
| `pnpm shots` | Screenshots of every screen (light/dark, desktop/phone) for visual review |

**App test hooks:** test builds (`MODE=test`) expose `window.__driftnote` helpers (for
example: inject a raw Yjs update, set `meta.schemaVersion`, clear the note-list store).
They are compiled out of normal builds. The server reads test-friendly timings (save
debounce, snapshot interval, ping interval) from environment variables.

Before each phase starts: state the phase plan in 5-10 lines and wait for the owner's OK.

---

## Phase 0: Setup (M0)

**Done when:** `pnpm check` is green locally on an empty app.

| ID | Goal | Deliverable | Tests first | Verify |
|---|---|---|---|---|
| T01 | Workspace root | `package.json` (private, `packageManager` pins pnpm, `engines` pins Node), `pnpm-workspace.yaml`, `.nvmrc`, extended `.gitignore` | none | `pnpm install --frozen-lockfile` succeeds; `node -v` matches `.nvmrc` |
| T02 | Strict TypeScript + shared package | `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); `packages/shared` whose `lib` excludes DOM and Node types | none | `pnpm typecheck` passes |
| T03 | Server skeleton + Vitest | `apps/sync-server` (TS, `tsx` dev, `tsc` build) with `GET /healthz`; root Vitest config; `test`/`test:int` scripts | integration: `/healthz` returns 200 | `pnpm test:int` green |
| T04 | Web skeleton + Playwright | `apps/web` (Vite + React) rendering the app title; Playwright config that builds the web app and starts the server | e2e `@M0`: app loads and shows "Driftnote" | `pnpm e2e` green |
| T05 | Lint and format | ESLint flat config (typescript-eslint type-checked), Prettier; `lint`, `format:check`, `check` scripts | none | `pnpm lint && pnpm format:check` pass |
| T07 | README stub + learning log | `README.md` (one-liner, run-locally steps), `docs/LEARNING_LOG.md` | none | A fresh clone follows the README steps to a running app |

## Phase 1: Single-user, offline-first editor (M1)

**Done when:** a Playwright test creates a note, goes offline, reloads, and sees the note intact.

| ID | Goal | Deliverable | Tests first | Verify |
|---|---|---|---|---|
| T10 | M1 acceptance test | `e2e/m1-offline.spec.ts`, expected-to-fail | e2e `@M1-done`: create note → offline → reload → content intact | `pnpm e2e --grep @M1-done` reports expected failure |
| T11 | Note docs + local persistence + editor | Shared note-ID generator and schema constants; one `Y.Doc` per note (`content`, `meta`); `y-indexeddb` persistence; route `/n/:noteId` with BlockNote bound to `content`; media blocks removed | e2e: new note → type → reload → intact; "/" menu has no image/video/audio/file | `pnpm e2e --grep @M1` (except `@M1-done`) green |
| T12 | Note list cache | `idb` store of note list (most recent first, titles from `meta`); rebuild-from-docs routine | e2e: rename → reload → list shows new title; clear list store via hook → reload → list rebuilt identically | `pnpm e2e --grep @M1` green |
| T13 | Local delete | Delete removes note from list and local storage | e2e: delete → gone from list; `/n/:id` shows "not found" | `pnpm e2e --grep @M1` green |
| T14 | Offline app shell | `vite-plugin-pwa` precache with SPA fallback; "new version, reload" prompt | e2e: offline reload of `/` and `/n/:id` loads the app | `pnpm e2e --grep @M1` green |
| T15 | Persistent storage | Call `navigator.storage.persist()` at startup; warning banner if refused | e2e: refused → banner visible; granted → no banner (API stubbed) | `pnpm e2e --grep @M1` green |
| T16 | Safe links | Only `http:`, `https:`, `mailto:` links rendered clickable | e2e: a `javascript:` link is not rendered as a working link | `pnpm e2e --grep @M1` green |
| T17 | Schema gate | Notes with `meta.schemaVersion` above the app's supported version open read-only with a message | e2e: hook sets a higher version → editor read-only, message shown | `pnpm e2e --grep @M1` green |
| T19 | Visual design baseline (added 2026-11-20 at the owner's request) | Design tokens, light/dark themes, two-pane app shell with sidebar note list, restyled note page, `docs/DESIGN.md`, `pnpm shots` screenshot capture | existing e2e stay green (they select by role, not style) | `pnpm check` and `pnpm e2e:all --grep @M1` green; screenshots reviewed |
| T18 | Close M1 | Playwright Firefox and WebKit installed locally (`@M1-done` was switched to a normal test in T14, the task that made it pass) | none | `pnpm check` green; `pnpm e2e:all --grep @M1` green |

## Phase 2: Real-time collaboration (M2)

**Done when:** a Playwright test with two contexts shows both edits merged in both views.

| ID | Goal | Deliverable | Tests first | Verify |
|---|---|---|---|---|
| S20 | Spike: tabs + unknown blocks | Learning-log entries: (1) does the stock provider keep two tabs in sync while offline? (2) what does BlockNote do with block types it does not know? | n/a | Entries exist with conclusions; `git status` shows no spike code |
| T21 | M2 acceptance test | `e2e/m2-collab.spec.ts`, expected-to-fail | e2e `@M2-done`: two contexts edit one note → both views show both edits | Reports expected failure |
| T22 | Single origin | Server serves the built web app; Vite dev proxies `/api` and `/sync`; Playwright runs app + API + WS on one origin | e2e `@M0` still green via server; integration: `GET /` serves `index.html` | `pnpm test:int && pnpm e2e` green |
| T23 | Database + migrations | SQLite connection (built-in `node:sqlite` if stable in the pinned Node, else `better-sqlite3`); migration runner; tables `notes`, `tokens`, `tombstones`, `snapshots`, `schema_migrations` | integration: fresh DB has all tables; running migrations twice is a no-op | `pnpm test:int` green |
| T24 | Rooms + sync relay | WebSocket endpoint `/sync/:noteId`; rooms map; sync step 1/2 and update relay; awareness relay and cleanup on close (auth stubbed open for now) | integration `rooms.int`: two clients converge; late joiner gets full state; disconnect-edit-reconnect catches up both ways; presence appears and is removed on close | `pnpm test:int` green |
| T25 | Room robustness | Shared load promise; unload grace period; message queue during load; ping/terminate; slow-consumer close | integration `room-lifecycle.int` (fake timers): two simultaneous joins load once; join during grace cancels unload; dead socket terminated and its cursor removed; queued messages applied after load | `pnpm test:int` green |
| T26 | Persistence | Debounced save (clear `dirty` before encode); load on room open | integration `persistence.int`: server restart reloads note; edit during save triggers a second save; saved blob contains all received changes | `pnpm test:int` green |
| T27 | Save acknowledgement | `ack` message (state vector + delete set) sent after durable save; client-side coverage check | **unit** `ack-coverage.test`: covered / not covered / deletes-only change. Integration: `ack` arrives only after the DB row is written and covers the client's changes | `pnpm test` green |
| T28 | Connect-time auth | Protocol version check (4426); tombstone check (4410); token hash lookup; owner claim for unknown note; reject (4401); connection tag | integration `auth.int`: every branch and close code; raw token bytes never appear in the DB file; captured logs never contain the token or query string | `pnpm test:int` green |
| T29 | Role filter | View connections: step 2 and updates dropped; step 1 and awareness allowed; outgoing unrestricted | integration `roles.int`: all 12 role × message combinations; viewer still receives live edits | `pnpm test:int` green |
| T30 | Limits | Document size limit (20 MB), message limit (24 MB) → 4413; update rate limit → 4429; per-IP connection limit | integration `limits.int`: each limit triggers its close code; a large-but-legal catch-up is accepted | `pnpm test:int` green |
| T31 | Token REST API | `POST/GET/DELETE /api/notes/:id/tokens`; owner-only; 401/403/404/410; revoke closes live sockets (4401) | integration `tokens-api.int`: owner creates edit/view tokens; editor gets 403; list has no plaintext; revoke disconnects a live client and rejects reconnect | `pnpm test:int` green |
| T32 | Client sync wiring | Provider per open note with this browser's token; owner claim on first sync; status badge (`data-sync-state`) driven by `ack`; "not backed up yet" marker in list | e2e: offline → `offline`; online → `syncing` → `synced`; marker shows offline and clears after `ack` | `pnpm e2e --grep @M2` green (except `@M2-done`) |
| T33 | Presence (done after T34, whose share links its test needs) | Name and colour prompt (stored in `localStorage`); remote cursors with labels | e2e: two contexts see each other's name on their cursors | `pnpm e2e --grep @M2` green |
| T34 | Share dialog + link opening | Create, copy, list and revoke edit/view links; recipient reads `#t`, stores the token, scrubs the URL, adds note to list | e2e: share edit link → second context joins and edits; URL has no `#t` after load; revoke → "link no longer valid" | `pnpm e2e --grep @M2` green |
| T35 | View-only client | Read-only editor for view role | e2e: view link → editor read-only; update injected via test hook never reaches the owner | `pnpm e2e --grep @M2` green |
| T36 | Tabs | Two tabs of one note stay in sync (approach per S20 findings) | e2e: two tabs, offline, edit in one → visible in the other | `pnpm e2e --grep @M2` green |
| T37 | Security headers | CSP (`script-src 'self'`), `Referrer-Policy: no-referrer`, HSTS when served over HTTPS | integration `headers.int`: headers present on app and API responses | `pnpm test:int` green |
| T38 | Close M2 | `@M2-done` switched to a normal test | none | `pnpm check` green; `pnpm e2e:all --grep "@M1\|@M2"` green |

## Phase 3: Offline conflict handling (M3)

**Done when:** concurrent offline edits to the same paragraph are both preserved, and the test is stable (5 consecutive local passes; also enforced in CI in Phase 6).

| ID | Goal | Deliverable | Tests first | Verify |
|---|---|---|---|---|
| S40 | Spike: offline WebSockets in Playwright | Learning-log entry: does `context.setOffline` cut WebSockets in each browser; how to use `routeWebSocket` instead | n/a | Entry exists; no spike code |
| T41 | M3 acceptance test | `e2e/m3-offline-merge.spec.ts`, expected-to-fail | e2e `@M3-done`: both users offline → both edit the same paragraph → reconnect → both edits present in both views | Reports expected failure |
| T42 | Network control helper | `e2e/support/network.ts`: `goOffline(context)` / `goOnline(context)` cutting HTTP and WebSockets | e2e: helper flips the status badge to `offline` and back to `synced` | `pnpm e2e --grep @M3` green (except `@M3-done`) |
| T43 | Delete for everyone | `DELETE /api/notes/:id` (owner): one transaction removes note, tokens, snapshots and writes tombstone; client UI; non-owners remove locally | integration `delete.int`: **zombie test**: stale client reconnects → 4410 → note not recreated; editor gets 403. e2e: collaborator sees "deleted by owner" | `pnpm test:int && pnpm e2e --grep @M3` green |
| T44 | Stranded edits | On 4401/4410 with unacknowledged changes, offer "Save my version as a new note" | e2e: link revoked while offline → reconnect → save as new note keeps content; same for note deleted while offline | `pnpm e2e --grep @M3` green |
| T45 | Convergence property test | fast-check generator: N clients, random edits, random disconnects, through the real server; seeds logged | integration `convergence.int`: all replicas and server converge | `pnpm test:int` green |
| T46 | Known-loss characterisation | Test pinning current behaviour: deleting a block while another user types inside it loses the typed text; learning-log entry | e2e or integration (whichever reproduces it reliably) | `pnpm test` / `pnpm e2e` green |
| T47 | Close M3 | `@M3-done` switched to a normal test | none | `pnpm e2e --grep @M3 --repeat-each=5` green; `pnpm e2e:all --grep @M3` green |

## Phase 4: Version history (M4)

**Done when:** a user can restore a note to an earlier state, and the restore syncs to collaborators.

| ID | Goal | Deliverable | Tests first | Verify |
|---|---|---|---|---|
| T50 | M4 acceptance test | `e2e/m4-history.spec.ts`, expected-to-fail | e2e `@M4-done`: edit → snapshot → edit → restore → both contexts show the earlier content | Reports expected failure |
| T51 | Retention policy | Pure function: given snapshots and "now", return those to prune | **unit** `retention.test` (property-based): named never pruned; all kept for 7 days; at most one per day to 90 days; nothing older kept except named | `pnpm test` green |
| T52 | Snapshot scheduler | Snapshot at most every 10 min while changed, on room empty, none if unchanged; retention job (intervals configurable) | integration `snapshots.int` (fake timers): each rule | `pnpm test:int` green |
| T53 | History API | `GET /api/notes/:id/snapshots`, `GET .../:sid`, `POST .../snapshots` (`named` / `pre-restore`); owner and edit only | integration `history-api.int`: list/fetch/create; view role gets 403; fetched snapshot loads with the content from that moment | `pnpm test:int` green |
| T54 | History panel | Panel listing versions; read-only preview; "Save version" with a name; hidden for viewers | e2e: list shows auto and named versions; preview does not change the live note; viewer sees no history | `pnpm e2e --grep @M4` green (except `@M4-done`) |
| T55 | Restore | `pre-restore` snapshot, then replace live blocks; undo works | e2e: restore syncs to collaborator; undo returns to pre-restore content; restore during concurrent typing behaves as documented | `pnpm e2e --grep @M4` green |
| T56 | Close M4 | `@M4-done` switched to a normal test | none | `pnpm check` green; `pnpm e2e:all --grep @M4` green |

## Phase 5: Accessibility and performance (M5)

**Done when:** axe reports no violations, the keyboard-only flow passes, and performance on a 10k-word note is measured, improved and recorded.

| ID | Goal | Deliverable | Tests first | Verify |
|---|---|---|---|---|
| T60 | Accessibility scans | `@axe-core/playwright` scans of note list, editor, share dialog, history panel; fixes | e2e `@M5`: zero violations on each screen | `pnpm e2e --grep @M5` green |
| T61 | Keyboard-only flow | Focus order, labels and shortcuts so the core flow needs no mouse; fixes | e2e: create, rename, share and restore using only the keyboard | `pnpm e2e --grep @M5` green |
| T62 | Performance baseline | Generator for a 10k+ word note; measurements of load time, typing latency and sync time; `docs/PERFORMANCE.md` with baseline | measurement script runs | `pnpm perf` prints results; baseline recorded |
| T63 | Performance budgets + optimisation | Budgets written as failing tests from target numbers, then optimisations; results recorded; size limits re-tuned (ADR 011) | perf tests with budgets | `pnpm perf` within budget; `docs/PERFORMANCE.md` updated |
| T64 | Manual audit | Manual keyboard and screen-reader pass; findings and fixes logged | n/a | Learning-log entry; `pnpm check` green |

## Phase 6: Continuous integration (final)

Until this phase, **local `pnpm check` is the gate** for every task. CI is added last.
Prerequisite: the owner grants the `gh` token the `workflow` scope
(`gh auth refresh -h github.com -s workflow`), which GitHub requires for workflow files.

**Done when:** CI on GitHub runs the same checks as `pnpm check` and is green on `main`.

| ID | Goal | Deliverable | Tests first | Verify |
|---|---|---|---|---|
| T70 | CI checks | `.github/workflows/ci.yml` on push/PR: install, lint, format, typecheck, `pnpm test`, `pnpm audit --audit-level high`, e2e (Chromium); Playwright report and traces uploaded on failure | none | `gh run list --limit 1` shows success on `main` |
| T71 | Nightly cross-browser | Scheduled (and manually triggerable) job running `pnpm e2e:all` | none | A manually triggered run (`gh workflow run ci.yml`) succeeds |
| T72 | Stability gate in CI | CI step running `pnpm e2e --grep @M3 --repeat-each=5` | none | Green in CI |

## Phase 7: Explorations (optional)

Each needs a new ADR approved before any tasks are planned:
- Note index and full-text search on SQLite-WASM/OPFS (ADR 004 option B).
- Port the sync server to Cloudflare Durable Objects (ADR 010 option C).
- End-to-end encryption (ADR 011).

**Deferred features (not scheduled):** recovery link and multi-device note list (ADR 006),
background sync of unopened notes (ADR 005), attributed coloured diffs in history
(ADR 007), media blocks (ADR 003), deployment (ADR 010).
