import {
  CLOSE_INVALID_TOKEN,
  CLOSE_NOTE_DELETED,
  CLOSE_PROTOCOL_TOO_OLD,
  createNoteId,
  createToken,
  PROTOCOL_VERSION,
} from "@driftnote/shared";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { startServer, type RunningServer } from "../src/server";
import { connectClient, destroyAllClients } from "./support/clients";
import { connectionOutcome } from "./support/rawSocket";
import { makeTempDir } from "./support/tempDir";

let dir: { path: string; cleanup: () => Promise<void> };
let server: RunningServer;
let logs: MockInstance[];

beforeEach(async () => {
  dir = await makeTempDir();
  server = await startServer({ port: 0, databasePath: join(dir.path, "notes.sqlite") });
  // Capture everything the server logs, to check tokens never appear in logs.
  logs = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => undefined),
  );
});

afterEach(async () => {
  destroyAllClients();
  await server.close();
  for (const spy of logs) spy.mockRestore();
  await dir.cleanup();
});

function url(noteId: string, params: { t?: string; pv?: number | null }): string {
  const query = new URLSearchParams();
  if (params.t !== undefined) query.set("t", params.t);
  if (params.pv !== null) query.set("pv", String(params.pv ?? PROTOCOL_VERSION));
  return `ws://127.0.0.1:${String(server.port)}/sync/${noteId}?${query.toString()}`;
}

const sha256 = (token: string): Buffer => createHash("sha256").update(token).digest();

function tokenRows(
  noteId: string,
): { role: string; token_hash: Buffer; revoked_at: number | null }[] {
  return server.db
    .prepare<[string], { role: string; token_hash: Buffer; revoked_at: number | null }>(
      "SELECT role, token_hash, revoked_at FROM tokens WHERE note_id = ?",
    )
    .all(noteId);
}

/** A note that exists on the server, owned by `ownerToken`. */
async function existingNote(): Promise<{ noteId: string; ownerToken: string }> {
  const noteId = createNoteId();
  const ownerToken = createToken();
  expect(await connectionOutcome(url(noteId, { t: ownerToken }))).toBe("accepted");
  return { noteId, ownerToken };
}

function addToken(noteId: string, token: string, role: "edit" | "view", revoked = false): void {
  server.db
    .prepare(
      "INSERT INTO tokens (note_id, token_hash, role, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(noteId, sha256(token), role, Date.now(), revoked ? Date.now() : null);
}

describe("connect-time auth", () => {
  it("refuses a missing or unsupported protocol version with 4426", async () => {
    const noteId = createNoteId();
    expect(
      await connectionOutcome(url(noteId, { t: createToken(), pv: PROTOCOL_VERSION + 1 })),
    ).toEqual({
      closed: CLOSE_PROTOCOL_TOO_OLD,
    });
    expect(await connectionOutcome(url(noteId, { t: createToken(), pv: null }))).toEqual({
      closed: CLOSE_PROTOCOL_TOO_OLD,
    });
  });

  it("refuses a deleted note with 4410, even for its owner", async () => {
    const { noteId, ownerToken } = await existingNote();
    server.db
      .prepare("INSERT INTO tombstones (note_id, deleted_at) VALUES (?, ?)")
      .run(noteId, Date.now());
    expect(await connectionOutcome(url(noteId, { t: ownerToken }))).toEqual({
      closed: CLOSE_NOTE_DELETED,
    });
  });

  it("the first connection to an unknown note claims it as owner, storing only a hash", async () => {
    const { noteId, ownerToken } = await existingNote();
    const rows = tokenRows(noteId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("owner");
    expect(rows[0]?.token_hash.equals(sha256(ownerToken))).toBe(true);

    // The owner can come back with the same token.
    expect(await connectionOutcome(url(noteId, { t: ownerToken }))).toBe("accepted");
    expect(tokenRows(noteId)).toHaveLength(1);
  });

  it("refuses an unknown token for an existing note with 4401", async () => {
    const { noteId } = await existingNote();
    expect(await connectionOutcome(url(noteId, { t: createToken() }))).toEqual({
      closed: CLOSE_INVALID_TOKEN,
    });
  });

  it("refuses a missing token, and will not let a weak token claim a new note", async () => {
    expect(await connectionOutcome(url(createNoteId(), {}))).toEqual({
      closed: CLOSE_INVALID_TOKEN,
    });
    expect(await connectionOutcome(url(createNoteId(), { t: "password123" }))).toEqual({
      closed: CLOSE_INVALID_TOKEN,
    });
  });

  it("refuses (does not crash on) a token that already owns another note", async () => {
    const { ownerToken } = await existingNote();
    expect(await connectionOutcome(url(createNoteId(), { t: ownerToken }))).toEqual({
      closed: CLOSE_INVALID_TOKEN,
    });
    // The server is still healthy.
    expect(await connectionOutcome(url(createNoteId(), { t: createToken() }))).toBe("accepted");
  });

  it("accepts edit and view tokens and tags the connection with its role", async () => {
    const { noteId } = await existingNote();
    const editToken = createToken();
    const viewToken = createToken();
    addToken(noteId, editToken, "edit");
    addToken(noteId, viewToken, "view");

    const editor = connectClient(server.port, noteId, { token: editToken });
    const viewer = connectClient(server.port, noteId, { token: viewToken });
    await Promise.all([editor.synced(), viewer.synced()]);

    const roles = [...(server.sync.rooms.get(noteId)?.connections.values() ?? [])].map(
      (c) => c.role,
    );
    expect(roles.sort()).toEqual(["edit", "view"]);
  });

  it("refuses a revoked token with 4401", async () => {
    const { noteId } = await existingNote();
    const revoked = createToken();
    addToken(noteId, revoked, "edit", true);
    expect(await connectionOutcome(url(noteId, { t: revoked }))).toEqual({
      closed: CLOSE_INVALID_TOKEN,
    });
  });

  it("never writes a token's text to the database files", async () => {
    const { noteId, ownerToken } = await existingNote();
    const editToken = createToken();
    addToken(noteId, editToken, "edit");
    await connectionOutcome(url(noteId, { t: editToken }));
    await connectionOutcome(url(noteId, { t: createToken() })); // a refused one too

    // The main file and the write-ahead log (where recent writes live in WAL mode).
    const files = readdirSync(dir.path).filter((f) => f.startsWith("notes.sqlite"));
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      const bytes = readFileSync(join(dir.path, file)).toString("latin1");
      expect(bytes, file).not.toContain(ownerToken);
      expect(bytes, file).not.toContain(editToken);
    }
  });

  it("never logs a token or a query string, including on refusals", async () => {
    const { noteId, ownerToken } = await existingNote();
    const wrong = createToken();
    await connectionOutcome(url(noteId, { t: wrong }));
    await connectionOutcome(url(noteId, { t: ownerToken, pv: 999 }));

    const logged = logs.flatMap((spy) => spy.mock.calls.flat().map(String)).join("\n");
    for (const secret of [ownerToken, wrong, "t=", "pv="]) {
      expect(logged).not.toContain(secret);
    }
  });
});
