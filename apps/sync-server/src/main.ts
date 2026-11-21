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

/** Optional timing overrides (milliseconds), e.g. short ones for e2e tests. */
function msFromEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a number of ms`);
  return value;
}
const saveDebounceMs = msFromEnv("SAVE_DEBOUNCE_MS");
const unloadGraceMs = msFromEnv("UNLOAD_GRACE_MS");
const pingIntervalMs = msFromEnv("PING_INTERVAL_MS");

const server = await startServer({
  port,
  host,
  databasePath,
  ...(staticDir ? { staticDir } : {}),
  sync: {
    ...(saveDebounceMs !== undefined ? { saveDebounceMs } : {}),
    ...(unloadGraceMs !== undefined ? { unloadGraceMs } : {}),
    ...(pingIntervalMs !== undefined ? { pingIntervalMs } : {}),
  },
});
console.log(`sync-server listening on http://${host}:${server.port}`);

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
