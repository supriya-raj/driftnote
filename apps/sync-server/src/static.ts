import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/** Paths owned by the server, never answered with the app page. */
const SERVER_PATHS = /^\/(api|sync)(\/|$)|^\/healthz$/;

/**
 * Serves the built web app (single origin, ADR 010): real files from `root`, and
 * `index.html` for any other GET so client-side routes like `/n/<id>` work on reload.
 * Returns false when the request is not for the app (the caller answers it).
 */
export async function serveStatic(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if ((req.method !== "GET" && req.method !== "HEAD") || SERVER_PATHS.test(pathname)) {
    return false;
  }

  const file = safeResolve(root, pathname);
  if (file && (await isFile(file))) {
    sendFile(req, res, file, cacheControlFor(pathname));
    return true;
  }

  // A missing file with an extension (e.g. an old /assets/x.js) is a real 404; the app
  // page would only confuse the browser. Extension-less paths are app routes.
  if (extname(pathname) !== "") {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return true;
  }
  sendFile(req, res, join(root, "index.html"), "no-cache");
  return true;
}

/**
 * Maps a URL path to a file inside `root`, or null if it would escape `root`. The path is
 * percent-decoded first, so `%2e%2e` ("..") cannot sneak past the check.
 */
function safeResolve(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // malformed escape sequence
  }
  if (decoded.includes("\0")) return null;
  const base = resolve(root);
  const target = resolve(base, `.${decoded}`);
  return target === base || target.startsWith(base + sep) ? target : null;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Hashed build files never change, so browsers may keep them forever. Entry points
 * (`index.html`, the service worker, the manifest) must be revalidated every time, or an
 * update would never reach users.
 */
function cacheControlFor(pathname: string): string {
  return pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
}

function sendFile(req: IncomingMessage, res: ServerResponse, file: string, cache: string): void {
  res.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": cache,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file)
    .on("error", () => res.destroy())
    .pipe(res);
}
