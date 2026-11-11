# ADR 011: Security and privacy baseline

- **Status:** Proposed
- **Date:** 2026-11-11

## Context

Every note syncs to the server in plaintext (ADR 005). Access is by bearer tokens in links
(ADR 006). Collaborators can write arbitrary content into shared documents. The brief lists
"the privacy and security implications of syncing user data" as a learning goal.

**Threat model (who could cause harm, and how):**

| Actor | Example harm |
|---|---|
| Malicious collaborator (has an edit link) | Inserts a `javascript:` link or crafted content (XSS); floods the doc with megabytes of text that is stored forever |
| Anyone who obtains a link | Reads/edits until the token is revoked |
| Network eavesdropper | Reads tokens or content in transit |
| Server database or backup leak | Reads all notes; tries to reuse tokens |
| Server operator | Can read all notes |
| Compromised dependency | Malicious code in the app or server |

## Options considered

- **A. Baseline hardening now; end-to-end encryption (E2EE) as M6 exploration.** Pros:
  addresses realistic threats at modest cost; keeps server-side features (snapshots,
  compaction) working. Cons: server operator can still read notes.
- **B. E2EE from the start** (server stores only ciphertext). Pros: strongest privacy.
  Cons: the server cannot merge, compact or snapshot encrypted updates, which undermines
  ADR 005 and ADR 007; key management and recovery become hard; large scope early.
- **C. Minimal (HTTPS only).** Cons: ignores XSS, abuse, and data-leak risks.

## Decision

Proposed: **A**.

- **Transport:** HTTPS/WSS everywhere outside local development; HSTS.
- **Content Security Policy:** `script-src 'self'`, no inline scripts, no third-party
  origins (fonts self-hosted). XSS would expose locally stored tokens, so CSP is a primary
  defence.
- **Link sanitisation:** link hrefs in documents are rendered only for `http:`, `https:`
  and `mailto:` schemes, because collaborators control document content.
- **Server limits:** maximum WebSocket message size, maximum stored document size,
  per-connection update rate limits, and per-IP connection limits; violations close the
  connection.
- **Headers:** `Referrer-Policy: no-referrer` (paths contain note IDs).
- **Logging:** never log query strings or `Authorization` headers; short retention for
  operational logs; no analytics or third-party scripts.
- **Deletion:** owner delete removes note data, tokens and snapshots; the tombstone keeps
  only the note ID and a timestamp. Backups retain deleted data until rotated out; this is
  documented.
- **Honesty in the UI and README:** state that the server operator can read synced notes.
- **Supply chain:** committed lockfile; `pnpm audit` in CI; automated dependency update PRs;
  pnpm's minimum-release-age setting to avoid installing just-published versions.
- **E2EE** stays an M6 exploration. If pursued, it changes the server to a relay of opaque
  blobs, moving compaction and history to clients; that requires new ADRs.

## Consequences

- CSP constrains how the app loads assets (no CDN scripts, no inline handlers).
- Limits need tuning against the 10k-word performance target (M5).
- Server-side snapshots and compaction remain possible because content is plaintext on the
  server; this is the explicit privacy trade-off.
