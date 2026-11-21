import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ackCovers, decodeAckMessage, encodeAckMessage } from "./ack";

/** Two docs syncing by hand: `server` plays the server, `local` the browser. */
function pair(): { local: Y.Doc; server: Y.Doc } {
  return { local: new Y.Doc(), server: new Y.Doc() };
}

function sync(from: Y.Doc, to: Y.Doc): void {
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)));
}

/** The ack the server would send right now: encoded, then decoded as the client would. */
function ackFrom(server: Y.Doc): Y.Snapshot {
  return decodeAckMessage(encodeAckMessage(server));
}

describe("ack coverage", () => {
  it("covered: the server has saved everything the client has", () => {
    const { local, server } = pair();
    local.getText("t").insert(0, "hello");
    sync(local, server);
    expect(ackCovers(local, ackFrom(server))).toBe(true);
  });

  it("not covered: the client typed after the server saved", () => {
    const { local, server } = pair();
    local.getText("t").insert(0, "hello");
    sync(local, server);
    const ack = ackFrom(server);
    local.getText("t").insert(5, " world");
    expect(ackCovers(local, ack)).toBe(false);
  });

  it("not covered: a change that only deletes text (state vectors miss deletions)", () => {
    const { local, server } = pair();
    local.getText("t").insert(0, "hello world");
    sync(local, server);
    const before = ackFrom(server);
    local.getText("t").delete(5, 6); // no insert at all: the state vector does not change
    expect(Y.encodeStateVector(local)).toEqual(Y.encodeStateVector(server));
    expect(ackCovers(local, before)).toBe(false);

    sync(local, server);
    expect(ackCovers(local, ackFrom(server))).toBe(true);
  });

  it("covered even when the server also has changes the client has not seen yet", () => {
    const { local, server } = pair();
    local.getText("t").insert(0, "mine");
    sync(local, server);
    server.getText("t").insert(0, "someone else's ");
    expect(ackCovers(local, ackFrom(server))).toBe(true);
  });

  it("covers changes from an earlier session with a different client ID", () => {
    const { local, server } = pair();
    const earlier = new Y.Doc();
    earlier.getText("t").insert(0, "typed yesterday, never synced");
    sync(earlier, local); // like reloading the note from IndexedDB in a new session
    local.getText("t").insert(0, "today: ");
    sync(local, server);
    expect(ackCovers(local, ackFrom(server))).toBe(true);

    const partial = new Y.Doc();
    Y.applyUpdate(partial, Y.encodeStateAsUpdate(earlier)); // server missing today's edit
    expect(ackCovers(local, ackFrom(partial))).toBe(false);
  });

  it("an empty note is covered by any ack", () => {
    const { local, server } = pair();
    expect(ackCovers(local, ackFrom(server))).toBe(true);
  });
});
