import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as Y from "yjs";

/**
 * Save acknowledgement (ADR 005 amendment, ARCHITECTURE.md section 6.1). After the server
 * has durably saved a note, it sends every connection a Yjs *snapshot* of what it saved:
 * a state vector (how many inserts it has from each client) plus a delete set (which
 * ranges are deleted). The delete set matters: a change that only deletes text does not
 * change the state vector at all.
 */
export const MESSAGE_ACK = 100; // above y-websocket's own message types (0-3)

/** The whole `ack` message for `doc`'s current state (server side). */
export function encodeAckMessage(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_ACK);
  encoding.writeVarUint8Array(encoder, Y.encodeSnapshot(Y.snapshot(doc)));
  return encoding.toUint8Array(encoder);
}

/** Reads an `ack` message (client side). Accepts the message with or without its type. */
export function decodeAckMessage(message: Uint8Array | decoding.Decoder): Y.Snapshot {
  if (message instanceof Uint8Array) {
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);
    if (type !== MESSAGE_ACK) throw new Error(`Not an ack message (type ${String(type)})`);
    return Y.decodeSnapshot(decoding.readVarUint8Array(decoder));
  }
  return Y.decodeSnapshot(decoding.readVarUint8Array(message));
}

/**
 * True when everything in `local` is in what the server saved: for every client, the
 * server has at least as many inserts, and every range `local` has deleted is deleted in
 * the saved state too. Changes from earlier sessions (other client IDs) count as well.
 */
export function ackCovers(local: Y.Doc, ack: Y.Snapshot): boolean {
  const mine = Y.snapshot(local);
  for (const [client, clock] of mine.sv) {
    if ((ack.sv.get(client) ?? 0) < clock) return false;
  }
  for (const [client, deleted] of mine.ds.clients) {
    const saved = ack.ds.clients.get(client) ?? [];
    for (const range of deleted) {
      if (!rangeCovered(range.clock, range.clock + range.len, saved)) return false;
    }
  }
  return true;
}

/** Whether [start, end) lies inside the union of `ranges` (sorted, as Yjs keeps them). */
function rangeCovered(
  start: number,
  end: number,
  ranges: readonly { clock: number; len: number }[],
): boolean {
  let covered = start;
  for (const r of ranges) {
    if (r.clock > covered) break; // a gap before this range
    covered = Math.max(covered, r.clock + r.len);
    if (covered >= end) return true;
  }
  return covered >= end;
}
