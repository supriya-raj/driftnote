import type { IncomingMessage, ServerResponse } from "node:http";
import type { TLSSocket } from "node:tls";

/**
 * Content Security Policy (ADR 011). The key line is `script-src 'self'`: only scripts
 * from this server run, so injected markup cannot execute code (tokens live in the
 * browser). Styles allow 'unsafe-inline': Mantine (BlockNote's UI) injects a <style> tag
 * and cursors/avatars use style attributes; inline styles cannot run code.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'", // same-origin fetch and WebSockets (/api, /sync)
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'", // never inside someone else's frame (clickjacking)
].join("; ");

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Adds the security headers to a response (ARCHITECTURE.md, security section). */
export function setSecurityHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  options: { trustProxy: boolean },
): void {
  res.setHeader("content-security-policy", CONTENT_SECURITY_POLICY);
  // Paths contain note IDs; never tell other sites where a click came from.
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("x-content-type-options", "nosniff");
  if (isHttps(req, options.trustProxy)) {
    res.setHeader("strict-transport-security", `max-age=${String(ONE_YEAR_SECONDS)}`);
  }
}

/**
 * HTTPS directly (a TLS socket), or via a proxy we were told to trust. Without that trust
 * an `X-Forwarded-Proto` header is just something a client typed.
 */
function isHttps(req: IncomingMessage, trustProxy: boolean): boolean {
  if ((req.socket as Partial<TLSSocket>).encrypted === true) return true;
  return trustProxy && req.headers["x-forwarded-proto"] === "https";
}
