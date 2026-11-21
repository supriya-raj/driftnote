import { request } from "node:http";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, type RunningServer } from "../src/server";
import { makeTempDir } from "./support/tempDir";

let server: RunningServer;
let cleanup: () => Promise<void>;
let base: string;

beforeEach(async () => {
  // The app lives in public/; secret.txt sits next to it and must never be served.
  const dir = await makeTempDir({
    "public/index.html": "<!doctype html><title>Driftnote</title>",
    "public/assets/app-abc123.js": "console.log('app')",
    "public/sw.js": "self.addEventListener('fetch', () => {})",
    "public/manifest.webmanifest": "{}",
    "secret.txt": "TOP SECRET",
  });
  cleanup = dir.cleanup;
  server = await startServer({ port: 0, staticDir: join(dir.path, "public") });
  base = `http://127.0.0.1:${server.port}`;
});

afterEach(async () => {
  await server.close();
  await cleanup();
});

describe("serving the web app (single origin)", () => {
  it("serves index.html at /", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    expect(await res.text()).toContain("<title>Driftnote</title>");
  });

  it("serves index.html for in-app routes, so deep links work", async () => {
    const res = await fetch(`${base}/n/AAAAAAAAAAAAAAAAAAAAA`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>Driftnote</title>");
  });

  it("serves built files with the right type and long caching for hashed assets", async () => {
    const res = await fetch(`${base}/assets/app-abc123.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/javascript/);
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(await res.text()).toBe("console.log('app')");
  });

  it("never lets the browser cache the app entry points", async () => {
    for (const path of ["/", "/sw.js"]) {
      const res = await fetch(`${base}${path}`);
      expect(res.headers.get("cache-control"), path).toBe("no-cache");
    }
  });

  it("returns 404 for a missing asset instead of the app page", async () => {
    const res = await fetch(`${base}/assets/missing.js`);
    expect(res.status).toBe(404);
  });

  it("never serves files outside the app folder (path traversal)", async () => {
    // Sent raw: `fetch` would normalise `..` away before it reached the server.
    for (const path of [
      "/../secret.txt",
      "/%2e%2e/secret.txt",
      "/..%2fsecret.txt",
      "/assets/..%2f..%2fsecret.txt",
      "/%2e%2e%5csecret.txt",
    ]) {
      expect(await rawGet(server.port, path), path).not.toContain("TOP SECRET");
    }
  });

  it("keeps server routes: /healthz and unknown /api paths are not the app page", async () => {
    expect(await (await fetch(`${base}/healthz`)).json()).toEqual({ status: "ok" });
    const api = await fetch(`${base}/api/nope`);
    expect(api.status).toBe(404);
    expect(await api.text()).not.toContain("<title>");
  });
});

/** GET with the path sent exactly as given (no URL normalisation). */
function rawGet(port: number, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.end();
  });
}
