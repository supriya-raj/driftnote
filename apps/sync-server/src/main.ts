import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { startServer } from "./server";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";
// Built web app to serve on the same origin, e.g. ../web/dist (unset in development, where
// Vite serves the app and proxies /api and /sync here).
const staticDir = process.env.STATIC_DIR;

const databasePath = process.env.DATABASE_PATH ?? "data/driftnote.sqlite";
mkdirSync(dirname(databasePath), { recursive: true });

const server = await startServer({
  port,
  host,
  databasePath,
  ...(staticDir ? { staticDir } : {}),
});
console.log(`sync-server listening on http://${host}:${server.port}`);

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
