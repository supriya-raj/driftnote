# ADR 008: Toolchain, monorepo and offline app shell

- **Status:** Accepted (2026-11-12)
- **Date:** 2026-11-11

## Context

Driftnote has a browser app, a Node sync server, and code shared between them (wire
message types, token roles, note ID generation, schema versions). The brief proposes pnpm
workspaces with `apps/web`, `apps/sync-server`, `packages/shared`, React + TypeScript +
Vite, strict TypeScript, ESLint/Prettier.

A gap this ADR also closes: **the app itself must load offline.** Local data (ADR 004) is
useless if a reload while offline shows the browser's "no internet" page. The M1 check
("go offline, reload, see the note") requires the app's HTML/JS/CSS to be cached by a
**service worker** (a background script the browser runs for the site, which can answer
requests from a cache).

## Options considered

### Monorepo tooling
- **A. pnpm workspaces (no task runner).** Pros: fast, strict dependency isolation (a
  package can only import what it declares), simple. Cons: no build caching; tasks run
  via `pnpm -r`. Right when: a small repo with three packages.
- **B. pnpm + Turborepo/Nx.** Pros: cached, parallel task graphs. Cons: another tool and
  config to learn before it pays off. Right when: many packages or slow builds.
- **C. npm workspaces.** Pros: no extra install. Cons: looser dependency isolation
  (phantom dependencies), slower. Right when: you want zero extra tooling.
- **D. Single package.** Pros: simplest. Cons: browser and Node code mixed; shared code
  boundaries unenforced. Right when: prototypes.

### Lint/format
- **A. ESLint (typescript-eslint, type-checked rules) + Prettier.** Pros: type-aware
  rules such as `no-floating-promises` (catches un-awaited async calls, common in sync
  code); huge ecosystem. Cons: two tools, slower.
- **B. Biome.** Pros: one fast tool for lint + format. Cons: fewer type-aware rules.

### Offline app shell
- **A. `vite-plugin-pwa` (Workbox) precaching.** Pros: generates the service worker from
  the build; handles cache versioning and update prompts; makes the app installable
  (which also avoids Safari's 7-day storage eviction, ADR 004). Cons: service-worker
  caching bugs can serve stale code; needs an update flow.
- **B. Hand-written service worker.** Pros: full understanding. Cons: cache versioning
  and update edge cases are easy to get wrong.
- **C. No service worker.** Cons: the app does not load offline; fails M1.

## Decision

- **pnpm workspaces**, no task runner initially (add Turborepo only if builds get slow).
  Layout: `apps/web`, `apps/sync-server`, `packages/shared`.
  - `packages/shared` must stay environment-neutral: no DOM or Node-only APIs.
- **TypeScript strict** everywhere via a shared base `tsconfig`, plus
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any` without a comment.
- **ESLint (typescript-eslint, type-checked) + Prettier.**
- **Web:** React + Vite. React Router for `/` (note list) and `/n/:noteId`. No global
  state library: React state plus Yjs observers.
- **Offline shell:** `vite-plugin-pwa` precaching the app shell, with SPA navigation
  fallback so `/n/:noteId` opens offline, and a "new version available, reload" prompt.
- **Server:** Node (current Active LTS at setup time), TypeScript run with `tsx` in dev and
  compiled with `tsc` for production; `ws` for WebSockets; SQLite via the built-in
  `node:sqlite` if stable in the chosen Node LTS, otherwise `better-sqlite3`.
- **Versions:** pin Node (`.nvmrc` + `engines`) and pnpm (`packageManager` field); exact
  versions chosen at M0 setup and recorded in the README.

## Consequences

- Three packages with explicit dependencies; shared code changes are visible in both apps'
  typechecks.
- Strict TypeScript and type-checked lint slow the first steps slightly but catch async and
  undefined-index bugs common in sync code.
- Service-worker caching needs an explicit update flow and e2e coverage; stale caches are a
  known class of bug to watch for.
- Installing the app (PWA) becomes the recommended way to use it on Safari.
