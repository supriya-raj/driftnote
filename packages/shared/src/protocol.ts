/**
 * Sync protocol message types: the first number in every WebSocket message. 0 and 1 are
 * the standard Yjs ones (what `y-websocket` speaks); Driftnote's own messages use other
 * numbers (ARCHITECTURE.md, section 6.1).
 */
export const MESSAGE_SYNC = 0; // sync step 1, sync step 2, update
export const MESSAGE_AWARENESS = 1; // presence: name, colour, cursor
