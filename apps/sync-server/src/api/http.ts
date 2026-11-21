import type { IncomingMessage, ServerResponse } from "node:http";

/** Small helpers for the JSON REST API. */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

export function sendStatus(res: ServerResponse, status: number): void {
  if (status === 204) {
    res.writeHead(204, { "cache-control": "no-store" });
    res.end();
    return;
  }
  sendJson(res, status, { error: ERROR_NAMES[status] ?? "error" });
}

const ERROR_NAMES: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  410: "gone",
  413: "too_large",
};

/** The bearer token from the Authorization header, or "" (never logged). */
export function bearerToken(req: IncomingMessage): string {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

const MAX_BODY_BYTES = 4 * 1024;

/** Reads a small JSON body; null if it is missing, too large or not JSON. */
export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}
