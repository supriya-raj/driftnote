/**
 * Sync protocol message types: the first number in every WebSocket message. 0 and 1 are
 * the standard Yjs ones (what `y-websocket` speaks); Driftnote's own messages use other
 * numbers (ARCHITECTURE.md, section 6.1).
 */
export const MESSAGE_SYNC = 0; // sync step 1, sync step 2, update
export const MESSAGE_AWARENESS = 1; // presence: name, colour, cursor

/** WebSocket close codes (ARCHITECTURE.md, section 6.1). 4000-4999 are for applications. */
export const CLOSE_INVALID_TOKEN = 4401; // invalid or revoked link
export const CLOSE_NOTE_DELETED = 4410; // the owner deleted the note
export const CLOSE_TOO_LARGE = 4413; // message or document too large
export const CLOSE_PROTOCOL_TOO_OLD = 4426; // the app must be updated
export const CLOSE_RATE_LIMITED = 4429; // too many updates; back off
