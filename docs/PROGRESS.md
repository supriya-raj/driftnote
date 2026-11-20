# Progress

## Current phase
**Phase 1: Single-user, offline-first editor (M1): in progress.** Phase 1 plan approved 2026-11-20.

## Next action
T12: note list cache (`idb` store, titles from `meta`, rebuild from docs); tests first.

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
| 1 | T12 | Note list cache | todo |
| 1 | T13 | Local delete | todo |
| 1 | T14 | Offline app shell | todo |
| 1 | T15 | Persistent storage | todo |
| 1 | T16 | Safe links | todo |
| 1 | T17 | Schema gate | todo |
| 1 | T18 | Close M1 | todo |
| 2 | S20 | Spike: tabs + unknown blocks | todo |
| 2 | T21 | M2 acceptance test | todo |
| 2 | T22 | Single origin | todo |
| 2 | T23 | Database + migrations | todo |
| 2 | T24 | Rooms + sync relay | todo |
| 2 | T25 | Room robustness | todo |
| 2 | T26 | Persistence | todo |
| 2 | T27 | Save acknowledgement | todo |
| 2 | T28 | Connect-time auth | todo |
| 2 | T29 | Role filter | todo |
| 2 | T30 | Limits | todo |
| 2 | T31 | Token REST API | todo |
| 2 | T32 | Client sync wiring | todo |
| 2 | T33 | Presence | todo |
| 2 | T34 | Share dialog + link opening | todo |
| 2 | T35 | View-only client | todo |
| 2 | T36 | Tabs | todo |
| 2 | T37 | Security headers | todo |
| 2 | T38 | Close M2 | todo |
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
| 5 | T60 | Accessibility scans | todo |
| 5 | T61 | Keyboard-only flow | todo |
| 5 | T62 | Performance baseline | todo |
| 5 | T63 | Performance budgets + optimisation | todo |
| 5 | T64 | Manual audit | todo |
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

## Open questions
- To answer by spikes: offline tab sync with the stock provider (S20); BlockNote's handling
  of unknown block types (S20); Playwright offline emulation of WebSockets (S40).
- `ack` message encoding: designed in T27.
- Whether built-in `node:sqlite` is stable in the pinned Node version: decided in T23.
- Bundle size: main JS chunk is 1.4 MB (440 kB gzipped), mostly BlockNote, plus ~25 locale
  chunks. Check the PWA precache size limit in T14; optimise in M5 (T63).

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
