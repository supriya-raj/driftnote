/**
 * Version of Driftnote's sync protocol. Clients send it when connecting; the server
 * refuses versions it cannot handle (ADR 012).
 */
export const PROTOCOL_VERSION = 1;

export * from "./note";
