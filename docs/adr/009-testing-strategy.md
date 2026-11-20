# ADR 009: Testing strategy

- **Status:** Accepted (2026-11-12)
- **Date:** 2026-11-11

## Context

The hardest bugs in local-first apps appear only with concurrency, reordering and flaky
networks. The brief asks for Vitest (unit), Playwright (e2e with multiple browser contexts
and offline simulation), CI on GitHub Actions, and M3 tests that are "stable in CI". The
hand-built server (ADR 005) and its authorisation rules (ADR 006) are security-critical.

## Options considered

- **A. Unit + e2e only (the brief's minimum).** Pros: two tools. Cons: e2e tests are slow
  and flaky for exploring many concurrency cases; server logic is tested only indirectly.
- **B. Layered pyramid: unit, CRDT property tests, server integration, e2e.** Pros: each
  risk tested at the cheapest layer; deterministic concurrency testing. Cons: more test
  infrastructure to build.
- **C. Mostly e2e.** Pros: tests what users see. Cons: slow, flaky, hard to debug; the
  opposite of "stable in CI".

## Decision

**B**.

| Layer | Tool | What it covers |
|---|---|---|
| Unit | Vitest | Token hashing and role checks; the role × message-type filter (ADR 006); snapshot retention policy; note-list cache rebuild; ID generation |
| CRDT property tests | Vitest + `fast-check` | 2-3 in-memory `Y.Doc`s receive random edits; updates are exchanged in random order, duplicated and delayed; assert all replicas converge. Seeds are logged so failures replay exactly |
| Server integration | Vitest (Node) | Server started in-process on a random port; real WebSocket clients. Sync and catch-up, offline-then-reconnect, view-only drops step 2 and updates, revoke disconnects live sockets, tombstones block resurrection, snapshot capture |
| End-to-end | Playwright | Multiple browser contexts as different users; one scenario per milestone "done when" check (M1-M4); service-worker offline reload |
| Accessibility (M5) | `@axe-core/playwright` + manual keyboard pass | Editor UI, history panel, share dialog |
| Performance (M5) | Scripted benchmarks | Generated 10k+ word document: load, typing latency, sync time; results recorded |

**Simulating bad networks:**
- Playwright `context.setOffline(true)` for HTTP and navigator state.
- For WebSockets, which offline emulation may not reliably cut in every browser, use
  Playwright's WebSocket routing (`page.routeWebSocket`) to drop, delay or close
  connections. Verify `setOffline` behaviour per browser at M3.

**Flakiness rules:**
- No fixed sleeps. Tests wait on observable state; the app exposes sync status in the DOM
  (e.g. `data-sync-state="synced"`), which also powers the brief's status indicator.
- CI retries at most once; a test that passes only on retry is logged as flaky and fixed.

**CI (GitHub Actions)** on every push/PR: lint, typecheck, unit + property + integration,
e2e on Chromium. Firefox and WebKit e2e run nightly and before each milestone is closed.
Playwright traces are uploaded on failure.

**Coverage:** no global percentage target; server auth/filter and persistence modules must
have direct tests.

## Consequences

- Extra up-front work: a test harness for in-process server + clients, and a fast-check
  edit generator.
- Concurrency bugs are found deterministically at the property-test layer rather than as
  flaky e2e failures.
- The DOM sync-state attribute becomes a small public testing contract the UI must keep.
- WebKit coverage catches Safari-specific storage and service-worker issues.

## Amendment (2026-11-12): integration- and e2e-first balance

The owner prefers few unit tests and more integration and e2e coverage, with TDD throughout.

- **Server integration tests (Vitest, real server in-process, real WebSocket clients, no
  browser)** are the main layer for server behaviour: role x message filter (all
  combinations), connect-time decisions and close codes, token rules, revocation, room
  load/unload races, save ordering, `ack` after durable save, tombstones, snapshots,
  limits, and no tokens in logs or the database. CRDT convergence property tests run through
  the real server here.
- **Playwright e2e** covers everything user-visible, including each milestone's
  "done when" check. Client-side behaviour (persistence, note list, offline shell, status
  indicator) is tested here rather than with client unit tests.
- **Unit tests only** for pure logic the other layers cannot reasonably reach: the snapshot
  retention policy (needs months of simulated time) and the `ack` coverage check (edge
  cases such as deletes-only changes).
- **TDD loop:** write the test, run it and show it failing, implement, re-run green,
  refactor, commit test and code together. Each milestone starts with its "done when" e2e
  test marked expected-to-fail, enabled when the milestone completes.
- **Trade-off accepted:** slower red/green loops and harder diagnosis than unit-heavy TDD.
- Library-behaviour questions are answered by time-boxed spikes (no TDD; findings logged,
  code discarded).

## Amendment (2026-11-20): CI added last

The owner wants tests passing locally first; CI is built in the final phase (execution plan
Phase 6). Until then:

- **Local `pnpm check`** (lint, format, typecheck, all Vitest tests, Chromium e2e) is the
  gate for every task; `pnpm e2e:all` (all browsers) runs locally when closing a milestone.
- The M3 stability gate (5 consecutive passes) runs locally; it is added to CI in Phase 6.
- The dependency audit (ADR 011) also moves into the Phase 6 CI job; until then it can be
  run locally with `pnpm audit`.
