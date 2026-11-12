# ADR 010: Deployment and hosting

- **Status:** Accepted (2026-11-12)
- **Date:** 2026-11-11

## Context

Sharing with real people requires the sync server to be reachable on the internet over
HTTPS/WSS (ADR 006). The server (ADR 005) holds rooms in memory and stores data in a
single SQLite file, so it needs a **long-running process** with **persistent disk**.
M0-M3 can be developed and tested entirely locally.

## Options considered

- **A. One small container/VM with a persistent volume** (e.g. Fly.io, Railway, Render, a
  Hetzner VPS). Pros: matches the server's design (long-lived WebSockets, SQLite file);
  cheap (a few dollars/month); HTTPS provided by most platforms. Cons: single instance, so
  no horizontal scaling; you own backups.
- **B. Serverless functions** (e.g. Vercel/Netlify functions). Pros: no servers to manage.
  Cons: poor or no support for long-lived WebSockets and local disk; does not fit.
- **C. Cloudflare Workers + Durable Objects.** Pros: built for per-room state and
  WebSockets; scales. Cons: different runtime and storage model; this is the brief's M6
  port, not the starting point.
- **D. Local machine + tunnel** (e.g. `cloudflared`, `ngrok`). Pros: free, instant demos.
  Cons: only up while your laptop is; not a real deployment.

## Decision

- **M0-M3:** local only. Use a tunnel (D) for ad-hoc demos with a friend.
- **From M2/M3 when needed:** **A**, a single container with a persistent volume. The
  specific host is chosen at deploy time, since it involves a payment decision by the
  owner.
- **One origin:** the Node server serves the built web app, the HTTP API and the
  WebSocket endpoint from the same domain, so there is one deploy, no CORS, and a simple
  CSP.
- **Backups:** periodic consistent SQLite copies (`VACUUM INTO`) to object storage, with
  rotation.
- **Single instance by design:** in-memory rooms require all clients of a note to reach the
  same process. Scaling out is out of scope (and is what the Durable Objects port explores).

## Consequences

- No hosting cost until real sharing is wanted.
- Deployment is a Dockerfile plus host config; a deploy task appears in the execution plan
  at M2/M3.
- Backups contain deleted notes until rotated out (see ADR 011).
- A restart drops live connections; clients reconnect automatically, and CRDT sync makes
  this safe.

## Amendment (2026-11-12): no deployment planned

The owner does not intend to deploy in the near future. All milestones run locally; the
deploy work (container, host, backups, production headers checks) is removed from the
execution plan and revisited only if sharing with real users becomes a goal. Design rules
that keep deployment possible later (single origin, single instance, configuration via
environment) still apply. Security headers are still set and tested locally (ADR 011).
