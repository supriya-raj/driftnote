import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { openDatabase, type Db } from "./db/database";
import { NotesStore } from "./db/notesStore";
import { TokensStore } from "./db/tokensStore";
import { handleTokensApi } from "./api/tokensApi";
import { authorize } from "./sync/auth";
import { setSecurityHeaders } from "./securityHeaders";
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
  /**
   * Set when a TLS-terminating proxy sits in front: its `X-Forwarded-Proto` is then
   * believed (for HSTS). Off by default, so clients cannot fake it.
   */
  readonly trustProxy?: boolean;
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

interface Services {
  readonly tokens: TokensStore;
  readonly sync: SyncEndpoint;
}

async function handleRequest(
  options: ServerOptions,
  services: Services,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  setSecurityHeaders(req, res, { trustProxy: options.trustProxy ?? false });

  if (req.method === "GET" && pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (await handleTokensApi(services, req, res, pathname)) return;
  if (options.staticDir && (await serveStatic(options.staticDir, req, res, pathname))) return;

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const db = openDatabase(options.databasePath ?? ":memory:");
  const notes = new NotesStore(db);
  const tokens = new TokensStore(db);
  const sync = new SyncEndpoint({
    authorize: (noteId, params) => authorize(tokens, noteId, params),
    loadNote: (noteId) => Promise.resolve(notes.load(noteId)),
    saveNote: (noteId, state, schemaVersion) => {
      notes.save(noteId, state, schemaVersion);
    },
    ...options.sync,
  });
  const http = createServer((req, res) => {
    handleRequest(options, { tokens, sync }, req, res).catch((err: unknown) => {
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
