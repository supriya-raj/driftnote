import {
  CLOSE_INVALID_TOKEN,
  createNoteId,
  createToken,
  isWellFormedToken,
  PROTOCOL_VERSION,
} from "@driftnote/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, type RunningServer } from "../src/server";
import { connectClient, defaultTokenFor, destroyAllClients } from "./support/clients";
import { connectionOutcome } from "./support/rawSocket";

let server: RunningServer;
let base: string;

beforeEach(async () => {
  server = await startServer({ port: 0 });
  base = `http://127.0.0.1:${String(server.port)}`;
});

afterEach(async () => {
  destroyAllClients();
  await server.close();
});

const eventually = (assertion: () => void): Promise<void> =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 });

/** A note that exists on the server; returns its ID and owner token. */
async function ownedNote(): Promise<{ noteId: string; owner: string }> {
  const noteId = createNoteId();
  const client = connectClient(server.port, noteId);
  await client.synced();
  return { noteId, owner: defaultTokenFor(noteId) };
}

function api(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return fetch(`${base}/api${path}`, { ...init, headers });
}

interface Created {
  tokenId: number;
  token: string;
  role: string;
  createdAt: number;
}

async function createLink(noteId: string, owner: string, role: "edit" | "view"): Promise<Created> {
  const res = await api(`/notes/${noteId}/tokens`, owner, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as Created;
}

function syncUrl(noteId: string, token: string): string {
  const query = new URLSearchParams({ t: token, pv: String(PROTOCOL_VERSION) });
  return `ws://127.0.0.1:${String(server.port)}/sync/${noteId}?${query.toString()}`;
}

describe("token REST API", () => {
  it("the owner creates edit and view links that work with their role", async () => {
    const { noteId, owner } = await ownedNote();
    const edit = await createLink(noteId, owner, "edit");
    const view = await createLink(noteId, owner, "view");

    expect(isWellFormedToken(edit.token)).toBe(true);
    expect(edit.role).toBe("edit");
    expect(view.role).toBe("view");
    expect(edit.tokenId).not.toBe(view.tokenId);

    const editor = connectClient(server.port, noteId, { token: edit.token });
    const viewer = connectClient(server.port, noteId, { token: view.token });
    await Promise.all([editor.synced(), viewer.synced()]);
    const roles = [...(server.sync.rooms.get(noteId)?.connections.values() ?? [])].map(
      (c) => c.role,
    );
    expect(roles).toEqual(expect.arrayContaining(["edit", "view"]));
  });

  it("lists links without ever returning a token", async () => {
    const { noteId, owner } = await ownedNote();
    const edit = await createLink(noteId, owner, "edit");
    await createLink(noteId, owner, "view");

    const res = await api(`/notes/${noteId}/tokens`, owner);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain(edit.token);
    expect(body).not.toContain(owner);
    const list = JSON.parse(body) as { tokenId: number; role: string; revokedAt: number | null }[];
    expect(list.map((l) => l.role).sort()).toEqual(["edit", "view"]); // owner's own not listed
    for (const item of list)
      expect(Object.keys(item).sort()).toEqual(["createdAt", "revokedAt", "role", "tokenId"]);
  });

  it("only the owner may manage links: an editor gets 403", async () => {
    const { noteId, owner } = await ownedNote();
    const edit = await createLink(noteId, owner, "edit");

    expect((await api(`/notes/${noteId}/tokens`, edit.token)).status).toBe(403);
    expect(
      (
        await api(`/notes/${noteId}/tokens`, edit.token, {
          method: "POST",
          body: '{"role":"edit"}',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api(`/notes/${noteId}/tokens/${String(edit.tokenId)}`, edit.token, {
          method: "DELETE",
        })
      ).status,
    ).toBe(403);
  });

  it("revoking a link disconnects its live users (4401) and refuses it afterwards", async () => {
    const { noteId, owner } = await ownedNote();
    const edit = await createLink(noteId, owner, "edit");
    const editor = connectClient(server.port, noteId, { token: edit.token });
    await editor.synced();
    const closeCodes: number[] = [];
    editor.provider.on("connection-close", (event: CloseEvent | null) => {
      if (event) closeCodes.push(event.code);
    });

    const res = await api(`/notes/${noteId}/tokens/${String(edit.tokenId)}`, owner, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    await eventually(() => {
      expect(closeCodes).toContain(CLOSE_INVALID_TOKEN);
    });
    editor.destroy();

    expect(await connectionOutcome(syncUrl(noteId, edit.token))).toEqual({
      closed: CLOSE_INVALID_TOKEN,
    });
    const list = (await (await api(`/notes/${noteId}/tokens`, owner)).json()) as {
      revokedAt: number | null;
    }[];
    expect(list[0]?.revokedAt).toEqual(expect.any(Number));
  });

  it("answers 401 for a missing, unknown or revoked token", async () => {
    const { noteId, owner } = await ownedNote();
    expect((await api(`/notes/${noteId}/tokens`, null)).status).toBe(401);
    expect((await api(`/notes/${noteId}/tokens`, createToken())).status).toBe(401);
    const edit = await createLink(noteId, owner, "edit");
    await api(`/notes/${noteId}/tokens/${String(edit.tokenId)}`, owner, { method: "DELETE" });
    expect((await api(`/notes/${noteId}/tokens`, edit.token)).status).toBe(401);
  });

  it("answers 404 for an unknown note and 410 for a deleted one", async () => {
    expect((await api(`/notes/${createNoteId()}/tokens`, createToken())).status).toBe(404);
    const { noteId, owner } = await ownedNote();
    server.db
      .prepare("INSERT INTO tombstones (note_id, deleted_at) VALUES (?, ?)")
      .run(noteId, Date.now());
    expect((await api(`/notes/${noteId}/tokens`, owner)).status).toBe(410);
  });

  it("rejects bad requests: unknown role, owner role, the owner's own token, other notes' links", async () => {
    const { noteId, owner } = await ownedNote();
    const post = (body: string): Promise<Response> =>
      api(`/notes/${noteId}/tokens`, owner, { method: "POST", body });
    expect((await post('{"role":"admin"}')).status).toBe(400);
    expect((await post('{"role":"owner"}')).status).toBe(400); // owners are never minted
    expect((await post("not json")).status).toBe(400);

    const ownerRow = server.db
      .prepare<[string], { token_id: number }>(
        "SELECT token_id FROM tokens WHERE note_id = ? AND role = 'owner'",
      )
      .get(noteId);
    const delOwner = await api(`/notes/${noteId}/tokens/${String(ownerRow?.token_id)}`, owner, {
      method: "DELETE",
    });
    expect(delOwner.status).toBe(404); // the owner's own token is not a revocable link

    const other = await ownedNote();
    const otherLink = await createLink(other.noteId, other.owner, "edit");
    const cross = await api(`/notes/${noteId}/tokens/${String(otherLink.tokenId)}`, owner, {
      method: "DELETE",
    });
    expect(cross.status).toBe(404); // you can only revoke links of your own note
  });
});
