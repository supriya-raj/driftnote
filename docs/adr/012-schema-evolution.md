# ADR 012: Schema evolution

- **Status:** Accepted (2026-11-12)
- **Date:** 2026-11-11

## Context

Driftnote's data lives in many places at once (every browser's IndexedDB, the server's
SQLite file, snapshots) and **old versions of the app keep running**: a client can be
offline for weeks with old code, then reconnect and sync. Unlike a server database, CRDT
documents cannot be migrated centrally; every replica holds its own copy, and an old
client can keep writing the old shape.

Things that will evolve:

1. The BlockNote block schema (ADR 003): new block types, changed props.
2. The note `meta` map (ADR 002): new fields.
3. The wire protocol: `y-protocols` plus Driftnote's auth parameters (ADR 006).
4. Server SQLite tables (notes, tokens, tombstones, snapshots).
5. The local note-list cache in IndexedDB (ADR 004).

Risk example: an old client that does not know a new block type may fail to render it or
drop it when editing, which could delete a collaborator's content.

## Options considered

- **A. Additive-only changes + tolerant readers + version gates.** Add fields and block
  types; never rename or remove. Readers ignore unknown fields and default missing ones.
  Clients that are too old to edit a document safely open it read-only and prompt a reload.
  Pros: works with replicas you do not control. Cons: old fields accumulate; requires
  discipline.
- **B. Migrate documents on load.** A newer client rewrites old-shaped documents when it
  opens them. Pros: data converges to the new shape. Cons: old clients still online can
  write the old shape back; concurrent migrations by two clients can duplicate content.
- **C. Copy-on-migrate (new document per breaking version).** Convert content into a new
  `Y.Doc` and tombstone the old one with a pointer. Pros: clean break. Cons: breaks links
  and history continuity; collaborators must follow the pointer.

## Decision

**A** by default, **C** as the escape hatch for unavoidable breaking changes.

- **Document schema version:** `meta.schemaVersion` (integer) records the newest schema
  feature used in a note. A client whose supported version is lower opens the note
  **read-only** and shows "update the app to edit this note".
- **Protocol version:** clients send `protocolVersion` when connecting; the server closes
  incompatible connections with a dedicated close code, and the client prompts a reload
  (ties into the service-worker update prompt, ADR 008).
- **Server SQLite:** ordered, forward-only SQL migration files tracked in a
  `schema_migrations` table, run at startup.
- **Local note-list cache:** on a version change, drop and rebuild it from note docs; this
  is safe because the cache is derived (ADR 002).
- **BlockNote upgrades:** pinned versions; upgrades are reviewed for schema changes and
  tested by opening documents created by the previous version (fixture docs kept in the
  repo).

## Consequences

- Removing a block type or field is effectively forbidden without a C-style migration.
- Every schema-affecting change bumps `schemaVersion` and needs a test with an older
  fixture.
- Read-only fallback for outdated clients prevents silent content loss at the cost of
  occasionally blocking edits until reload.
