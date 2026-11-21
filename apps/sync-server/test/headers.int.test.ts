import { afterEach, describe, expect, it } from "vitest";
import { startServer, type RunningServer } from "../src/server";
import { makeTempDir } from "./support/tempDir";

let server: RunningServer | undefined;
let cleanup: (() => Promise<void>) | undefined;

afterEach(async () => {
  await server?.close();
  await cleanup?.();
  server = undefined;
  cleanup = undefined;
});

async function start(options: { trustProxy?: boolean } = {}): Promise<string> {
  const dir = await makeTempDir({
    "index.html": "<!doctype html><title>Driftnote</title>",
    "assets/app.js": "1",
  });
  cleanup = dir.cleanup;
  server = await startServer({ port: 0, staticDir: dir.path, ...options });
  return `http://127.0.0.1:${String(server.port)}`;
}

const PATHS = [
  "/",
  "/n/AAAAAAAAAAAAAAAAAAAAA",
  "/assets/app.js",
  "/healthz",
  "/api/notes/x/tokens",
  "/nope.js",
];

describe("security headers", () => {
  it("every response carries the CSP, referrer and nosniff headers", async () => {
    const base = await start();
    for (const path of PATHS) {
      const res = await fetch(`${base}${path}`);
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(csp, path).toContain("script-src 'self'");
      expect(csp, path).toContain("object-src 'none'");
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(res.headers.get("referrer-policy"), path).toBe("no-referrer");
      expect(res.headers.get("x-content-type-options"), path).toBe("nosniff");
    }
  });

  it("sends HSTS only over HTTPS, never over plain HTTP", async () => {
    const base = await start();
    const res = await fetch(`${base}/`);
    expect(res.headers.get("strict-transport-security")).toBeNull();
    // A client claiming HTTPS through a header is ignored unless a proxy is trusted.
    const spoofed = await fetch(`${base}/`, { headers: { "x-forwarded-proto": "https" } });
    expect(spoofed.headers.get("strict-transport-security")).toBeNull();
  });

  it("sends HSTS when a trusted proxy says the request came over HTTPS", async () => {
    const base = await start({ trustProxy: true });
    const res = await fetch(`${base}/`, { headers: { "x-forwarded-proto": "https" } });
    expect(res.headers.get("strict-transport-security")).toMatch(/max-age=\d+/);
    const plain = await fetch(`${base}/`);
    expect(plain.headers.get("strict-transport-security")).toBeNull();
  });
});
