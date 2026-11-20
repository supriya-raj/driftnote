import { nanoid } from "nanoid";

/**
 * Note IDs are long random strings generated on the client (ADR 002), so a note can be
 * created offline without asking a server. 21 nanoid characters ≈ 126 random bits.
 */
export const NOTE_ID_LENGTH = 21;
const NOTE_ID_PATTERN = /^[A-Za-z0-9_-]{21}$/;

export function createNoteId(): string {
  return nanoid(NOTE_ID_LENGTH);
}

export function isNoteId(value: string): boolean {
  return NOTE_ID_PATTERN.test(value);
}

/** Names of the shared types inside each note's Y.Doc (ADR 002). */
export const NOTE_CONTENT_KEY = "content"; // Y.XmlFragment bound to the editor
export const NOTE_META_KEY = "meta"; // Y.Map: title, createdAt, schemaVersion

/**
 * Newest document schema version this code understands (ADR 012). A note whose
 * `meta.schemaVersion` is higher opens read-only (T17).
 */
export const NOTE_SCHEMA_VERSION = 1;
