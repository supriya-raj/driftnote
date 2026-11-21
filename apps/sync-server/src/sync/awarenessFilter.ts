import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";

/**
 * Keeps only the entries of an awareness update whose client ID passes `allowed`. The
 * y-protocols format is: entry count, then per entry the client ID, a clock and the state
 * as a JSON string. Returns null when no entry is left.
 */
export function filterAwarenessUpdate(
  update: Uint8Array,
  allowed: (clientId: number) => boolean,
): Uint8Array | null {
  const decoder = decoding.createDecoder(update);
  const count = decoding.readVarUint(decoder);
  const kept: { clientId: number; clock: number; state: string }[] = [];
  for (let i = 0; i < count; i++) {
    const clientId = decoding.readVarUint(decoder);
    const clock = decoding.readVarUint(decoder);
    const state = decoding.readVarString(decoder);
    if (allowed(clientId)) kept.push({ clientId, clock, state });
  }
  if (kept.length === 0) return null;
  if (kept.length === count) return update;
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, kept.length);
  for (const entry of kept) {
    encoding.writeVarUint(encoder, entry.clientId);
    encoding.writeVarUint(encoder, entry.clock);
    encoding.writeVarString(encoder, entry.state);
  }
  return encoding.toUint8Array(encoder);
}
