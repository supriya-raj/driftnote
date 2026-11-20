# Driftnote

A local-first, real-time collaborative notes app: it works fully offline, syncs when a
connection returns, and merges concurrent edits without conflicts.

> **Status:** single-user offline-first editor works (M1). Next: real-time collaboration
> (M2). See [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Run locally

Prerequisites: [nvm](https://github.com/nvm-sh/nvm) and pnpm 12
(`npm install -g pnpm@12`).

```sh
nvm install && nvm use   # Node version from .nvmrc
pnpm install
pnpm dev                 # web app on http://localhost:5173, sync server on :4000
```

## Checks

```sh
pnpm --filter @driftnote/web exec playwright install chromium   # once, for e2e tests
pnpm --filter @driftnote/web exec playwright install firefox webkit   # once, for e2e:all
pnpm check   # lint, format, typecheck, unit + integration tests, e2e (Chromium)
```

Individual commands: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
`pnpm test:int`, `pnpm e2e`, `pnpm e2e:all`.

## Repository layout

| Path | What |
|---|---|
| `apps/web` | Browser app (React + Vite), Playwright e2e tests in `e2e/` |
| `apps/sync-server` | Hand-built Yjs sync server (Node), integration tests in `test/` |
| `packages/shared` | Code shared by both (no browser or Node APIs) |
| `docs/` | Architecture, decisions, plan, progress, learning log |

## Docs

- [Project brief](PROJECT_BRIEF.md): goals and features
- [Architecture](docs/ARCHITECTURE.md): system design walkthrough
- [Architecture decision records](docs/adr/): every significant choice and why
- [Execution plan](docs/EXECUTION_PLAN.md) and [progress](docs/PROGRESS.md)
- [Learning log](docs/LEARNING_LOG.md): what I learned along the way
