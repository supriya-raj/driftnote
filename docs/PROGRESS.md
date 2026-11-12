# Progress

## Current phase
**Planning complete. Execution plan awaiting owner approval.** No implementation has started.

## Next action
Owner reviews and approves `docs/EXECUTION_PLAN.md`. Then: state the Phase 0 plan in 5-10
lines, get an OK, and start **T01**.

## Task status

| Phase | ID | Task | Status |
|---|---|---|---|
| 0 | T01 | Workspace root | todo |
| 0 | T02 | Strict TypeScript + shared package | todo |
| 0 | T03 | Server skeleton + Vitest | todo |
| 0 | T04 | Web skeleton + Playwright | todo |
| 0 | T05 | Lint and format | todo |
| 0 | T06 | CI | todo |
| 0 | T07 | README stub + learning log | todo |
| 1 | T10 | M1 acceptance test | todo |
| 1 | T11 | Note docs + local persistence + editor | todo |
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
  consecutive passes.

## Open questions
- To answer by spikes: offline tab sync with the stock provider (S20); BlockNote's handling
  of unknown block types (S20); Playwright offline emulation of WebSockets (S40).
- `ack` message encoding: designed in T27.
- Whether built-in `node:sqlite` is stable in the pinned Node version: decided in T23.

## In-progress notes
None.

## Handoff note
Architecture discussion finished: 12 accepted ADRs and `docs/ARCHITECTURE.md`. The
execution plan is written but **not yet approved**: do not start T01 until the owner
approves it.
