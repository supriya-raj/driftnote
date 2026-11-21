import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { openDatabase, type Db } from "./db/database";
import { serveStatic } from "./static";
import { SyncEndpoint, type SyncOptions } from "./sync/syncEndpoint";

export interface ServerOptions {
  /** Port to listen on; 0 picks any free port (used by tests). */
  readonly port: number;
  readonly host?: string;
  /** Folder with the built web app to serve on the same origin (ADR 010). */
  readonly staticDir?: string;
  /** SQLite file; defaults to an in-memory database (tests that do not need persistence). */
  readonly databasePath?: string;
  /** Sync tuning, mostly for tests (timers, grace period, ping interval, note loading). */
  readonly sync?: SyncOptions;
}

export interface RunningServer {
  /** The port actually bound (useful when `port: 0` was requested). */
  readonly port: number;
  readonly db: Db;
  readonly sync: SyncEndpoint;
  close(): Promise<void>;
}

async function handleRequest(
  options: ServerOptions,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (options.staticDir && (await serveStatic(options.staticDir, req, res, pathname))) return;

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const db = openDatabase(options.databasePath ?? ":memory:");
  const sync = new SyncEndpoint(options.sync);
  const http = createServer((req, res) => {
    handleRequest(options, req, res).catch((err: unknown) => {
      console.error("request failed", err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  sync.attach(http);

  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port, options.host ?? "127.0.0.1", () => {
      http.off("error", reject);
      resolve();
    });
  });

  const address = http.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the server to be bound to a TCP port");
  }

  return {
    port: address.port,
    db,
    sync,
    close: async () => {
      sync.close();
      await new Promise<void>((resolve, reject) => {
        http.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      db.close();
    },
  };
}
