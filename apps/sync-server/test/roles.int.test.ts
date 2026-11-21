import {
  createNoteId,
  createToken,
  MESSAGE_AWARENESS,
  MESSAGE_SYNC,
  PROTOCOL_VERSION,
} from "@driftnote/shared";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket as RawWebSocket } from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { hashToken } from "../src/db/tokensStore";
import { startServer, type RunningServer } from "../src/server";
import { connectClient, destroyAllClients } from "./support/clients";

type Role = "owner" | "edit" | "view";
type Kind = "sync step 1" | "sync step 2" | "update" | "awareness";

let server: RunningServer;
const sockets: RawWebSocket[] = [];

beforeEach(async () => {
  server = await startServer({ port: 0 });
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  destroyAllClients();
  await server.close();
});

const eventually = (assertion: () => void): Promise<void> =>
  vi.waitFor(assertion, { timeout: 3000, interval: 20 });

/** A note owned by a client, plus an edit and a view token for it. */
async function noteWithTokens(): Promise<{ noteId: string; tokens: Record<Role, string> }> {
  const noteId = createNoteId();
  const owner = connectClient(server.port, noteId);
  await owner.synced();
  const tokens = { owner: "", edit: createToken(), view: createToken() };
  tokens.owner = (owner.provider.params as { t: string }).t;
  for (const role of ["edit", "view"] as const) {
    server.db
      .prepare("INSERT INTO tokens (note_id, token_hash, role, created_at) VALUES (?, ?, ?, ?)")
      .run(noteId, hashToken(tokens[role]), role, Date.now());
  }
  return { noteId, tokens };
}

interface Raw {
  ws: RawWebSocket;
  received: Uint8Array[];
}

async function openRaw(noteId: string, token: string): Promise<Raw> {
  const query = new URLSearchParams({ t: token, pv: String(PROTOCOL_VERSION) });
  const ws = new RawWebSocket(
    `ws://127.0.0.1:${String(server.port)}/sync/${noteId}?${query.toString()}`,
  );
  sockets.push(ws);
  const raw: Raw = { ws, received: [] };
  ws.on("message", (data: Buffer) => raw.received.push(new Uint8Array(data)));
  await new Promise((resolve) => ws.once("open", resolve));
  await eventually(() => {
    expect(raw.received.length).toBeGreaterThan(0); // the server's opening sync step 1
  });
  return raw;
}

/** A Yjs change inserting `text`, as an update and as a sync step 2 answering "I have nothing". */
function changeWith(text: string): { update: Uint8Array; step2: Uint8Array } {
  const doc = new Y.Doc();
  doc.getText("t").insert(0, text);
  const update = Y.encodeStateAsUpdate(doc);
  const step2 = encoding.createEncoder();
  encoding.writeVarUint(step2, MESSAGE_SYNC);
  syncProtocol.writeSyncStep2(step2, doc, Y.encodeStateVector(new Y.Doc()));
  const upd = encoding.createEncoder();
  encoding.writeVarUint(upd, MESSAGE_SYNC);
  syncProtocol.writeUpdate(upd, update);
  return { update: encoding.toUint8Array(upd), step2: encoding.toUint8Array(step2) };
}

function step1Message(): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, new Y.Doc());
  return encoding.toUint8Array(encoder);
}

function awarenessMessage(clientId: number, name: string): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = clientId;
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState({ user: { name } });
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, [clientId]),
  );
  awareness.destroy();
  return encoding.toUint8Array(encoder);
}

/** Whether `raw` has received a sync step 2 (the server answering its step 1). */
function receivedStep2(raw: Raw): boolean {
  return raw.received.some((message) => {
    const decoder = decoding.createDecoder(message);
    return (
      decoding.readVarUint(decoder) === MESSAGE_SYNC &&
      decoding.readVarUint(decoder) === syncProtocol.messageYjsSyncStep2
    );
  });
}

const serverText = (noteId: string): string =>
  server.sync.rooms.get(noteId)?.doc.getText("t").toJSON() ?? "";

const ALLOWED: Record<Role, Record<Kind, boolean>> = {
  owner: { "sync step 1": true, "sync step 2": true, update: true, awareness: true },
  edit: { "sync step 1": true, "sync step 2": true, update: true, awareness: true },
  view: { "sync step 1": true, "sync step 2": false, update: false, awareness: true },
};

const CASES = (Object.keys(ALLOWED) as Role[]).flatMap((role) =>
  (Object.keys(ALLOWED[role]) as Kind[]).map((kind) => ({
    role,
    kind,
    allowed: ALLOWED[role][kind],
  })),
);

let nextClientId = 1000;

describe("role filter", () => {
  it.each(CASES)("$role sending $kind: allowed = $allowed", async ({ role, kind, allowed }) => {
    const { noteId, tokens } = await noteWithTokens();
    const raw = await openRaw(noteId, tokens[role]);
    const text = `${role}-${kind}`;
    const clientId = nextClientId++;

    if (kind === "sync step 1") {
      raw.received.length = 0;
      raw.ws.send(step1Message());
      await eventually(() => {
        expect(receivedStep2(raw)).toBe(true);
      });
      return; // every role may ask what it is missing
    }

    if (kind === "awareness") {
      raw.ws.send(awarenessMessage(clientId, text));
      await eventually(() => {
        expect(server.sync.rooms.get(noteId)?.awareness.getStates().has(clientId)).toBe(true);
      });
      return;
    }

    const change = changeWith(text);
    raw.ws.send(kind === "update" ? change.update : change.step2);
    // Barrier: an awareness message from the same socket. Messages from one socket are
    // handled in order, so once it shows up, the change above has been handled too.
    raw.ws.send(awarenessMessage(clientId, "barrier"));
    await eventually(() => {
      expect(server.sync.rooms.get(noteId)?.awareness.getStates().has(clientId)).toBe(true);
    });
    expect(serverText(noteId).includes(text)).toBe(allowed);
  });

  it("a viewer still receives live edits from others", async () => {
    const { noteId, tokens } = await noteWithTokens();
    const viewer = connectClient(server.port, noteId, { token: tokens.view });
    const editor = connectClient(server.port, noteId, { token: tokens.edit });
    await Promise.all([viewer.synced(), editor.synced()]);

    editor.text.insert(0, "visible to the viewer");
    await eventually(() => {
      expect(viewer.text.toJSON()).toBe("visible to the viewer");
    });
  });

  it("a viewer's local edits never reach the server or other people", async () => {
    const { noteId, tokens } = await noteWithTokens();
    const viewer = connectClient(server.port, noteId, { token: tokens.view });
    const editor = connectClient(server.port, noteId, { token: tokens.edit });
    await Promise.all([viewer.synced(), editor.synced()]);

    viewer.text.insert(0, "sneaky ");
    editor.text.insert(0, "legit");
    await eventually(() => {
      expect(viewer.text.toJSON()).toContain("legit");
    });
    expect(serverText(noteId)).toBe("legit");
    expect(editor.text.toJSON()).toBe("legit");
  });
});
