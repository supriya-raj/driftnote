# ADR 006: Sharing, identity and recovery

- **Status:** Proposed
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

Proposed: **B**.

- **Tokens:** 128-bit+ random, generated with `crypto.getRandomValues`. Roles: `owner`,
  `edit`, `view`. Server stores `sha256(token)`, role, note ID, created/revoked timestamps.
- **Links:** `/n/<noteId>#t=<token>`. The client moves the token from the fragment into
  local storage on open, then presents it when connecting.
- **Server checks** the token on WebSocket connect; rejects unknown or revoked tokens;
  for `view` connections, relays outgoing updates and awareness but drops incoming document
  updates.
- **Owner registration:** first sync of a new note registers its owner-token hash
  (first-writer-wins for an unknown note ID).
- **Revocation:** owner can revoke a share token ("reset link").
- **Delete:** owner deletes for everyone. The server deletes the note data and keeps a
  **deletion tombstone** so stale offline replicas cannot resurrect it; clients show
  "deleted by owner". Non-owners remove the note from their own list only.
- **Display identity:** name and colour chosen locally on first use, stored in
  `localStorage`; unverified.
- **Recovery:** a per-browser **workspace**: a secret workspace ID plus token. The note list
  (IDs and tokens) is mirrored into a small workspace `Y.Doc` that syncs to the server
  (the additive "index doc" upgrade left open in ADR 002). The user saves a **recovery
  link**; opening it in any browser restores the list. This also enables multi-device.

Open questions (to be resolved before acceptance):
1. Sharing model: B (proposed) or A?
2. View-only links: include (proposed) or edit-only?
3. Recovery: recovery link (proposed), manual export, or defer?

## Consequences

- Server gains a token table and connect-time authorisation; the hand-built server
  (ADR 005) owns this logic, which needs focused tests.
- Display names are unverified; presence must not be treated as proof of identity.
- Tokens stored in browser storage are as safe as the device; anyone with the device or
  the recovery link has full access.
- Deletion tombstones are permanent server records (small).
- Adopting the workspace doc amends ADR 002's decision (note list no longer purely local);
  ADR 002 should be updated to reference this ADR.
- The server can still read all note content; only end-to-end encryption (M6) changes that.
