# ADR 006: Sharing, identity and recovery

- **Status:** Accepted (2026-11-11)
- **Date:** 2026-11-11

## Context

The brief requires notes shareable by link for real-time editing, with **no accounts**.
Terms: **authentication** (who are you) vs **authorisation** (what may you do). Without
accounts there is no conventional authentication, but the server (ADR 005) still needs
authorisation, because every note syncs to it, including unshared private notes.

The standard accountless pattern is a **capability link**: possession of a long random
secret grants access. Secrets placed in the URL **fragment** (`#...`) are not sent in HTTP
requests, so they stay out of server logs, analytics and link previews; the client presents
them to the sync server over the encrypted WebSocket.

Carried-over questions: what "delete" means for shared notes (ADR 002), and how a user
recovers their notes from the server backup when their local note list is lost (ADR 005).

## Options considered

### A. Note ID is the capability
- Pros: simplest; nothing to verify.
- Cons: not revocable (only by copying to a new ID); no view-only; no owner; private notes
  protected only by an ID that also appears in browser history.
- Right when: demos/prototypes.

### B. Note ID + secret tokens with roles (owner / edit / view)
Owner token generated client-side at note creation and kept locally; share tokens created
on demand with a role. Server stores only token **hashes** and checks them on connect.
- Pros: revocable ("reset link"); view-only enforced by the server ignoring incoming
  updates on view connections; an owner exists, which defines delete semantics; good
  security learning at modest size.
- Cons: token generation, a server table, connect-time checks, and link-management UI.
- Right when: link sharing that must be reasonably safe.

### C. Real accounts (magic link, OAuth, passkeys)
- Pros: real identity; per-person revocation; multi-device and recovery solved.
- Cons: contradicts the brief's no-account principle; large scope; server holds PII.
- Right when: a real product with teams.

### D. Cryptographic device identities (key pairs, signed capabilities)
- Pros: no server-side identity; local-first purist.
- Cons: complex and easy to get subtly wrong; recovery harder.
- Right when: research; possible M6 companion to end-to-end encryption.

## Decision

**B**, including view-only links. Recovery is deferred.

- **Tokens:** 128-bit+ random, generated with `crypto.getRandomValues`. Roles: `owner`,
  `edit`, `view`. Server stores `sha256(token)`, role, note ID, created/revoked timestamps.
- **Links:** `/n/<noteId>#t=<token>`. The client moves the token from the fragment into
  local storage on open, then presents it when connecting.
- **Token transport:** browser WebSocket APIs cannot set custom headers, so the token is
  sent as a query parameter (supported by the stock `WebsocketProvider`). The server and
  any proxy must never log query strings. A first-message auth handshake with a custom
  provider is a possible later upgrade.
- **Connect-time check** (before any sync): reject if the note has a deletion tombstone;
  look up `(noteId, sha256(token))` among non-revoked tokens; if not found and the note ID
  is unknown, register the token as `owner` (first-writer-wins; safe because the ID is
  generated randomly by the creator and not yet disclosed); otherwise reject. The
  connection is then tagged with `{ noteId, tokenId, role }`.
- **Per-message enforcement** by role: sync step 1 (state vector request) and awareness
  are allowed for all roles; sync step 2 and update messages (incoming document changes)
  are applied only for `owner`/`edit` and dropped for `view`. Blocking step 2 is
  essential, not just live updates. Outgoing messages are unrestricted.
- **Client read-only mode** for `view` is a UX courtesy only; the server filter is the
  security boundary.
- **Token management over HTTP**, authorised by `Authorization: Bearer <ownerToken>`:
  `POST /notes/:id/tokens` (server generates a share token, stores its hash, returns the
  plaintext once), `DELETE /notes/:id/tokens/:tokenId` (revoke), `DELETE /notes/:id`
  (delete note). The owner token is client-generated because notes are created offline.
- **Link handling:** the client reads `#t=` on open, stores the token locally, and removes
  the fragment from the address bar (`history.replaceState`).
- **Revocation:** sets `revoked_at` and immediately disconnects live connections using
  that token. "Reset link" = revoke + create a new token.
- **Delete:** owner deletes for everyone. The server deletes the note data and keeps a
  **deletion tombstone** so stale offline replicas cannot resurrect it; clients show
  "deleted by owner". Non-owners remove the note from their own list only.
- **Display identity:** name and colour chosen locally on first use, stored in
  `localStorage`; unverified.
- **Token IDs:** each token row has a short non-secret ID (a label, like a key-ring tag).
  It names a token in revoke requests and the share-panel UI, and live connections record
  it so revocation can disconnect them. The server never holds plaintext tokens, so it
  needs this handle; the hash could serve, but a separate ID keeps hashes out of URLs/UI.
- **Owner's local copy of share links:** the owner's client keeps created share tokens
  locally so "Copy link" works later (same risk profile as the owner token).

Resolved questions:
1. Sharing model: **B**.
2. View-only links: **included**.
3. Recovery: **deferred**. The workspace/recovery-link design (a secret workspace ID whose
   small `Y.Doc` mirrors the note list and tokens, saved as a recovery link) is the
   preferred future option; it would implement ADR 002's additive option B.

## Consequences

- Server gains a token table and connect-time authorisation; the hand-built server
  (ADR 005) owns this logic, which needs focused tests.
- Display names are unverified; presence must not be treated as proof of identity.
- Tokens stored in browser storage are as safe as the device; anyone with the device or
  the recovery link has full access.
- Deletion tombstones are permanent server records (small).
- With recovery deferred, a wiped browser loses its note list **and its owner tokens**.
  The server backup (ADR 005) then protects collaborators' access, not the owner's;
  ownership of such notes cannot be reclaimed. ADR 002 is unchanged for now.
- The server can still read all note content; only end-to-end encryption (M6) changes that.
- Tokens are bearer capabilities: a forwarded link grants the same access until revoked.
- Tokens are 256-bit random values, so a fast hash (SHA-256) suffices; slow password
  hashes (bcrypt/argon2) are unnecessary. Lookup is by hash, avoiding timing-sensitive
  string comparison.
- Requires HTTPS/WSS everywhere outside local development.
- A viewer who tampers with their client can diverge their own local copy; this never
  reaches the server or other users.
