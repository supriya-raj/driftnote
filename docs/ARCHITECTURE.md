# Driftnote: system design

A design-round style walkthrough of how Driftnote works: requirements, components, data
model, APIs, and the main flows. Libraries are named only in passing; the *why* behind each
choice lives in the ADRs (index at the bottom).

---

## 1. The system in one paragraph

Every note is a **CRDT document** (a data structure that merges concurrent edits
automatically). The **browser holds the real copy** of each note and saves it locally, so
the app works with no network. A small **sync server** keeps its own copy of every note,
relays live changes between collaborators, and acts as the **gatekeeper** that checks share
links. Because the data structure itself guarantees merging, the server never resolves
conflicts. It is just another copy that never goes offline, plus access control, backups and
version history.

---

## 2. Requirements

**Functional**
- Create, edit, rename and delete notes with no account and no network.
- Notes persist locally and back up to the server.
- Share a note by link with an **edit** or **view** role; revoke links.
- Real-time co-editing with presence (names, colours, cursors).
- Offline edits merge on reconnect without data loss.
- Connection status indicator: offline / syncing / synced.
- Version history: browse, preview, restore, save named versions.

**Non-functional**
- **Local-first:** reads and writes hit local storage first; the network is optional.
- **Convergence:** all copies end up identical; no conflict prompts.
- **Security:** unguessable, revocable links; view-only enforced by the server.
- **Scale:** hobby scale; one server instance; documents of 10k+ words.

**Out of scope (for now):** accounts, images/files, multi-device note list, recovery of a
wiped browser, end-to-end encryption.

---

## 3. Vocabulary (the minimum you need)

| Term | Meaning in Driftnote |
|---|---|
| **Doc** | One note's CRDT document. Holds `content` (rich text) and `meta` (title, created date, schema version). |
| **Update** | A small binary chunk describing a change to a doc. Saving, syncing and merging are all "move updates around". |
| **State vector** | A compact summary of "which updates I have". Two sides swap state vectors to work out what each is missing. |
| **Awareness** | Temporary presence data (name, colour, cursor). Broadcast live, never stored. |
| **Room** | The server's in-memory group of connections editing the same note. One room per open note. |
| **Token** | A long random secret in a share link. Possessing it grants a role: `owner`, `edit` or `view`. |
| **Tombstone** | A "this was deleted" marker. (Yjs uses them internally for deleted characters; our server uses one row per deleted note so it cannot come back.) |
| **Snapshot** | A full saved copy of a note at a moment in time, for version history. |

---

## 4. High-level architecture

```
┌─────────────────────────── Browser ────────────────────────────┐
│                                                                │
│   UI (note list, share dialog, history panel, status badge)    │
│      │                                                         │
│   Editor ◀──▶ Doc (one per note) ──▶ IndexedDB                  │
│                  │      │            (note data + note list)   │
│                  │      └──▶ other tabs (same-browser channel)  │
│                  │                                             │
│            WebSocket client                  HTTP client       │
│                  │                               │             │
│   Service worker (caches the app so it loads offline)          │
└──────────────────┼───────────────────────────────┼─────────────┘
                   │ WSS: sync + presence          │ HTTPS: REST
┌──────────────────┼───────────────────────────────┼─────────────┐
│                  ▼                               ▼             │
│        WebSocket gateway                     REST API          │
│        (checks token on connect)             (tokens, delete,  │
│                  │                            history)         │
│                  ▼                               │             │
│        Room manager                              │             │
│        (in-memory doc per open note,             │             │
│         role-based message filter)               │             │
│                  │                               │             │
│        Snapshot scheduler + retention job        │             │
│                  │                               │             │
│                  ▼                               ▼             │
│        ┌─────────────────── SQLite ───────────────────┐        │
│        │  notes │ tokens │ tombstones │ snapshots     │        │
│        └──────────────────────────────────────────────┘        │
│                                                                │
│        Also serves the built web app (single origin)           │
│                         Sync server (one process)              │
└────────────────────────────────────────────────────────────────┘
```

### Component responsibilities

**Browser**
| Component | Job |
|---|---|
| Editor | Turns typing into changes on the note's doc; renders others' changes and cursors. Read-only for viewers. |
| Doc | The note's data. The single source of truth for content and title. |
| IndexedDB | Persists each doc, plus a small **note list** (a cache rebuilt from the docs) and the tokens this browser holds. |
| Tab channel | Sends changes between tabs of the same browser instantly, even offline. |
| WebSocket client | Connects the open note to the server: catch-up sync, live updates, presence. |
| HTTP client | Share-link management, delete, version history. |
| Service worker | Caches the app's own files so a reload works with no network. |

**Server**
| Component | Job |
|---|---|
| WebSocket gateway | Accepts connections; validates the token **once** at connect; tags the connection with its note and role. |
| Room manager | Keeps one in-memory doc per open note; applies incoming changes (if the role allows), forwards them to everyone else in the room, saves to SQLite. |
| REST API | Token create/list/revoke, note delete, snapshot list/fetch/create. |
| Snapshot scheduler | Takes snapshots of active notes; prunes old ones. |
| SQLite | Durable storage for note state, tokens, tombstones and snapshots. |

---

## 5. Data model

### 5.1 Inside a note's doc

```
Doc (one per note)
├── content : rich text (blocks: paragraphs, headings, lists, tables, ...)
└── meta    : map
    ├── title          string
    ├── createdAt      timestamp
    └── schemaVersion  integer   (newest format feature this note uses)
```

The **title lives inside the doc**, so renames sync to collaborators like any other edit.

### 5.2 Server: SQLite tables

```
notes
  note_id         TEXT  PRIMARY KEY      -- random 21-char ID, generated by the browser
  state           BLOB  NOT NULL         -- whole note, compacted into one update
  schema_version  INT   NOT NULL
  created_at      INT   NOT NULL
  updated_at      INT   NOT NULL

tokens
  token_id        INTEGER PRIMARY KEY    -- short, non-secret label ("link #2")
  note_id         TEXT  NOT NULL  → notes.note_id
  token_hash      BLOB  NOT NULL  UNIQUE -- SHA-256 of the token; plaintext never stored
  role            TEXT  NOT NULL         -- 'owner' | 'edit' | 'view'
  created_at      INT   NOT NULL
  revoked_at      INT   NULL             -- set on revoke; row kept for the share panel
  INDEX (note_id)

tombstones
  note_id         TEXT  PRIMARY KEY      -- a deleted note's ID; refuses future syncs
  deleted_at      INT   NOT NULL

snapshots
  snapshot_id     INTEGER PRIMARY KEY
  note_id         TEXT  NOT NULL  → notes.note_id
  created_at      INT   NOT NULL
  kind            TEXT  NOT NULL         -- 'auto' | 'named' | 'pre-restore'
  name            TEXT  NULL             -- only for 'named'
  state           BLOB  NOT NULL         -- full note copy at that moment
  size_bytes      INT   NOT NULL
  INDEX (note_id, created_at DESC)

schema_migrations
  version         INT   PRIMARY KEY
  applied_at      INT   NOT NULL
```

Design notes:
- **Why hash tokens:** a leaked database yields fingerprints, not working links.
- **Why `token_id`:** the server never has plaintext tokens, so it needs a label to
  revoke or list a specific link.
- **Delete is one transaction:** delete `snapshots`, `tokens` and `notes` rows for the note,
  then insert a `tombstones` row.
- **Notes store one compacted blob,** not a change log. History comes from `snapshots`.

### 5.3 Browser: local storage

```
IndexedDB, one database per note (managed by the persistence library)
  → that note's updates, periodically compacted

IndexedDB "driftnote" database
  notes (key: noteId)                       -- the note list; a rebuildable cache
    noteId, title, updatedAt,
    role,            -- this browser's role for the note
    token,           -- this browser's token for the note (owner token if creator)
    syncedAt         -- last time the server confirmed it is up to date
    INDEX updatedAt  -- for "most recent first"
  shareLinks (key: tokenId)                 -- only on the owner's browser
    tokenId, noteId, role, token, createdAt -- so "Copy link" works later

localStorage
  displayName, colour                       -- presence identity (unverified)
```

---

## 6. APIs

### 6.1 WebSocket: sync and presence

**Connect**

```
wss://<host>/sync/<noteId>?t=<token>&pv=<protocolVersion>
```

(The token is in the query string because browsers cannot set custom headers on
WebSockets. The server and any proxy must never log query strings.)

**Handshake checks, in order, before any data flows:**

```
1. pv supported?                      no  → close 4426 "update the app"
2. noteId in tombstones?              yes → close 4410 "note deleted"
3. look up (noteId, sha256(t)), not revoked
      found                           → role = owner | edit | view
      not found, note unknown         → register t as OWNER (first sync claims a new note)
      not found, note exists          → close 4401 "invalid or revoked link"
4. tag connection: { noteId, tokenId, role }
5. join room (load note from SQLite if the room is not in memory)
6. start sync: exchange state vectors, send missing updates, send current presence
```

**Message types** (standard Yjs wire format) and what each role may send:

| Client → server message | Meaning | owner | edit | view |
|---|---|---|---|---|
| Sync step 1 | "Here's what I have; send what I'm missing" | ✅ | ✅ | ✅ |
| Sync step 2 | "Here's what *you're* missing" (catch-up) | ✅ apply | ✅ apply | ❌ drop |
| Update | "I just changed something" (live) | ✅ apply | ✅ apply | ❌ drop |
| Awareness | Name, colour, cursor | ✅ | ✅ | ✅ |

Server → client messages are never restricted. "Apply" means: merge into the room's doc,
forward to everyone else in the room, schedule a save.

**Save acknowledgement (server → client, custom message):** after a client's changes are
durably saved, the server sends `ack` with its state vector **and** delete set (state
vectors count inserts only). The client shows **synced** only when this covers all of its
own changes, and records `syncedAt`. No pull-before-push ordering is required: both sides
send concurrently and CRDT merging is order-independent.

**Close codes** (app-defined)

| Code | Meaning | Client reaction |
|---|---|---|
| 4401 | Invalid or revoked token | Show "link no longer valid"; if unsynced changes exist, offer "Save my version as a new note" |
| 4410 | Note deleted | Show "deleted by owner"; if unsynced changes exist, offer "Save my version as a new note"; then remove from list |
| 4413 | Message or document too large | Show error; stop retrying |
| 4426 | Protocol too old | Prompt "new version available, reload" |
| 4429 | Rate limited | Back off, then reconnect |

### 6.2 REST

All endpoints take `Authorization: Bearer <token>`. The server resolves the token to a role
exactly as in the WebSocket handshake.

| Method & path | Who | Purpose | Response |
|---|---|---|---|
| `POST /api/notes/:id/tokens` `{ role: "edit" \| "view" }` | owner | Create a share link | `201 { tokenId, token, role, createdAt }` (token shown **once**) |
| `GET /api/notes/:id/tokens` | owner | List links for the share panel | `200 [{ tokenId, role, createdAt, revokedAt }]` |
| `DELETE /api/notes/:id/tokens/:tokenId` | owner | Revoke a link; disconnects its live sockets | `204` |
| `DELETE /api/notes/:id` | owner | Delete note for everyone; writes tombstone | `204` |
| `GET /api/notes/:id/snapshots` | owner, edit | List versions | `200 [{ snapshotId, createdAt, kind, name, sizeBytes }]` |
| `GET /api/notes/:id/snapshots/:sid` | owner, edit | Download one version | `200` binary note state |
| `POST /api/notes/:id/snapshots` `{ kind: "named" \| "pre-restore", name? }` | owner, edit | Save a named version, or a safety copy before restore | `201 { snapshotId }` |
| `GET /healthz` | anyone | Liveness check | `200` |

Errors: `401` bad or revoked token, `403` role not allowed, `404` unknown note,
`410` note deleted.

---

## 7. Server internals

### 7.1 Room lifecycle

```
first connection for a note
   └─▶ load notes.state from SQLite into an in-memory doc  →  room is LIVE

while live
   ├─ incoming change (allowed role) → apply → forward to others → mark dirty
   ├─ save: debounced (a couple of seconds after the last change) → write notes.state
   └─ snapshot: at most every 10 minutes if changed since the last snapshot

last connection leaves
   └─▶ save → snapshot (if changed) → keep in memory briefly → unload
```

**Implementation shape:** plain Node + the `ws` library; rooms are a `Map<noteId, Room>` in
memory. No framework, Redis or broker.

```
Room
  doc                    server's copy of the note
  awareness              presence for this note
  conns                  Map<socket, { noteId, tokenId, role, awarenessIds }>
  dirty                  changed since last save
  changedSinceSnapshot   changed since last snapshot
  saveTimer, unloadTimer
loading: Map<noteId, Promise<Room>>   one load per note, shared by concurrent joiners
```

**Message routing:** decode the message type → apply the role filter → apply to `room.doc`.
Forwarding is driven by the doc's update event: each change is sent to every connection in
the room except the one it came from (the change's origin). Awareness works the same way.

**Robustness rules**
- **Load race:** concurrent first joins share one load via `loading`, so a note never has
  two in-memory copies.
- **Unload race:** a join during the unload grace period cancels the unload.
- **Dead connections:** ping every ~30 s; terminate sockets that do not answer and remove
  the presence entries they owned (prevents ghost cursors).
- **Messages that arrive during room load** are queued until the room is ready.
- **Slow consumers:** close sockets whose outgoing buffer keeps growing.
- **No locks:** Node handles one message at a time, so room state is never mutated
  concurrently within the process.

### 7.2 Durability: why losing a few seconds is acceptable

Saves are debounced, so a server crash can lose the last few seconds of changes **on the
server**. That's acceptable because **every client still has those changes**. On reconnect
the state-vector exchange shows the server is behind, and clients send the missing updates
again automatically. The CRDT makes this safe: duplicates and reordering are harmless. The
only loss is if the server *and* every client that held the change disappear together.

### 7.3 Save correctness (is `notes.state` fresh?)

```
room.dirty = false                       // clear BEFORE encoding: no lost-change gap
blob = encodeStateAsUpdate(room.doc)     // the whole merged doc, never a diff
UPDATE notes SET state = blob ...        // one transaction
```
- The blob contains everything the server has received at that instant; later changes set
  `dirty` again and schedule another save.
- **Saves cannot be reordered:** single-threaded event loop + a synchronous SQLite API, so
  encode-and-write is one uninterrupted step. (An async driver would need a save queue or
  version checks.)
- **Single process** (ADR 010) means no competing writers. Scale-out path: merge with the
  stored row inside the write transaction, which is safe because CRDT merges are
  idempotent.
- The server may lag behind offline clients; that is expected. Merges only add
  information, so it never moves backwards, and reconnecting clients catch it up.

### 7.4 Version history

- **Capture:** the server snapshots the room's doc (full copy) at most every 10 minutes while
  it is edited, and when the room empties.
- **Retention job:** keep every `auto` snapshot for 7 days, then one per day for 90 days,
  then delete. `named` snapshots are kept forever.
- **Restore is a forward edit, not a rewind.** Collaborators hold newer copies that would
  merge back, so the client: (1) asks the server for a `pre-restore` snapshot, then
  (2) replaces the live note's content to match the old version. That edit syncs to
  everyone like any other change, and can be undone.
- Viewers cannot see history (old versions may contain deliberately deleted text).
- History needs the server, so it is unavailable offline.

---

## 8. Key flows

**8.1 Create and edit offline**
```
browser: generate noteId + ownerToken → create doc → edits → save to IndexedDB
         → update note list.                                    (no network)
```

**8.2 First sync ("claiming" the note)**
```
browser ──connect(noteId, ownerToken)──▶ server: unknown note → store hash as OWNER
browser ◀════ sync (state vectors, missing updates) ════▶ server: save notes.state
```

**8.3 Share and join**
```
owner  ──POST /tokens {edit}──▶ server: new token, store hash ──▶ { tokenId, token }
owner  builds link  /n/<noteId>#t=<token>   (the #part is never sent to servers)
friend opens link → app reads #t, stores it, removes it from the address bar
friend ──connect(noteId, token)──▶ server: hash → EDIT → join room → live sync + presence
```

**8.4 Offline merge**
```
Alice and Bob both edit while disconnected
Alice reconnects → swaps state vectors with server → each sends what the other lacks
Bob reconnects   → same → server forwards Alice's changes to Bob and Bob's to Alice
result: everyone converges to the same note; both edits kept
```

**8.5 View-only**
```
viewer connects → tagged VIEW → receives all changes and presence
viewer's step 2 / update messages → dropped by the server
(the read-only editor is a convenience; the server filter is the real guard)
```

**8.6 Revoke**
```
owner ──DELETE /tokens/2──▶ server: set revoked_at → close live sockets tagged tokenId=2
future connects with that token → 4401
```

**8.7 Delete**
```
owner ──DELETE /notes/:id──▶ server: remove note, tokens, snapshots; insert tombstone
stale offline copy reconnects → tombstone check → 4410 → app shows "deleted by owner"
(without the tombstone, the stale copy would be treated as a new note and come back)
```

**8.8 Restore a version**
```
editor ──GET /snapshots──▶ list → GET /snapshots/:sid → preview in a read-only viewer
"Restore" ──POST /snapshots {pre-restore}──▶ safety copy
client replaces live content with the old version's content → syncs to everyone
```

---

## 9. Consistency, failures and scale

**Consistency model:** *strong eventual consistency*. Any two copies that have received the
same changes are identical, in any order. There is no global ordering and no locking; the
server is a peer, not a referee.

**What "no merge conflicts" does and does not mean**
- Every character is an item with a permanent ID `(clientId, clock)` and anchors to its
  neighbours' IDs. Inserts reference anchors, not positions; deletes mark items as
  tombstones; ties are broken deterministically. So every copy converges and new text is
  never discarded.
- Converged is not the same as sensible: two people replacing the same word yield both
  words (`dogcow`); a delete racing an edit can leave fragments.
- Formatting and other properties are last-writer-wins with a deterministic tie-break.
- **Known data-loss case:** if one person deletes a whole block (e.g. a paragraph) while
  another types inside it, the typed text is lost with its deleted parent. Needs an M3 test;
  version history is the mitigation.

**Connection status** (shown in the UI and exposed in the DOM for tests):
`offline` (no socket) → `syncing` (connected, but the server has not yet acknowledged all
local changes) → `synced` (the server's `ack` covers every local change).

**Failure modes**
| Failure | Effect | Recovery |
|---|---|---|
| Client offline | Edits continue locally | Catch-up sync on reconnect |
| Server restart or crash | Live sockets drop; last few seconds unsaved on server | Clients reconnect and resend (7.2) |
| Browser storage wiped | Local notes, list and tokens lost | Collaborators unaffected; owner cannot recover (recovery deferred) |
| Old app version reconnects | Might not understand new formats | Protocol check (4426) and read-only mode for newer-format notes |
| Malicious collaborator | Junk or harmful content | Size/rate limits, safe link rendering, revoke the link |

**Scale**
- **One server process by design:** rooms live in memory, so all clients of a note must
  reach the same process.
- **Bottlenecks if it grew:** memory per open note, SQLite write volume.
- **How you'd scale later:** route each note to a fixed server by `noteId` (sharding), or
  move to one-object-per-note platforms such as Cloudflare Durable Objects (the M6 idea).

---

## 10. Security summary

- Bearer-token links; only hashes stored; tokens kept out of logs and out of the URL sent
  to servers.
- Server-enforced roles at connect (token check) and per message (role filter).
- Revocation takes effect immediately (live sockets closed).
- Tombstones prevent deleted notes from coming back.
- Strict Content Security Policy; only `http`, `https` and `mailto` links rendered.
- Size and rate limits: document size is the real cap; the message limit is at least the
  document limit so large offline catch-ups are accepted.
- HTTPS/WSS everywhere outside local development.
- **Known trade-off:** the server can read every note (all notes sync in plaintext).

---

## 11. Open items

- **Background sync of unopened notes:** build now, or defer until recovery is built?
  (Pending decision; affects ADR 005.)
- `ack` message encoding: designed in M2.
- To verify during implementation: tab-to-tab sync while offline; how the editor handles
  unknown block types from newer app versions; offline simulation of WebSockets in e2e
  tests; whether the built-in Node SQLite module is stable enough.

---

## 12. ADR index

| ADR | Topic | Decision | Status |
|---|---|---|---|
| [001](adr/001-crdt-library.md) | CRDT library | Yjs | Accepted |
| [002](adr/002-document-model.md) | Document model | One doc per note; local, rebuildable note list | Accepted |
| [003](adr/003-editor.md) | Editor | BlockNote, no media blocks | Accepted |
| [004](adr/004-local-storage.md) | Local storage | IndexedDB; request persistent storage | Accepted |
| [005](adr/005-sync-topology.md) | Sync topology | Hand-built WebSocket relay server; all notes sync | Accepted |
| [006](adr/006-sharing-and-identity.md) | Sharing and identity | Hashed role tokens (owner/edit/view); recovery deferred | Accepted |
| [007](adr/007-version-history.md) | Version history | Server full-copy snapshots; forward restore; named versions | Accepted |
| [008](adr/008-toolchain-and-monorepo.md) | Toolchain | pnpm monorepo, strict TS, React + Vite, offline app shell | Accepted |
| [009](adr/009-testing-strategy.md) | Testing | Unit, CRDT property tests, server integration, e2e | Accepted |
| [010](adr/010-deployment-and-hosting.md) | Deployment | Local first; then one container + disk, single origin | Accepted |
| [011](adr/011-security-and-privacy.md) | Security and privacy | Baseline hardening; E2EE later | Accepted |
| [012](adr/012-schema-evolution.md) | Schema evolution | Additive-only changes + version gates | Accepted |
