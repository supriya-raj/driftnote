import { nanoid } from "nanoid";

/**
 * Capability tokens (ADR 006): 43 random URL-safe characters (about 256 bits), generated
 * by the browser. The server only ever stores their SHA-256 hash.
 */
const TOKEN_LENGTH = 43;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createToken(): string {
  return nanoid(TOKEN_LENGTH);
}

export function isWellFormedToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export type Role = "owner" | "edit" | "view";
