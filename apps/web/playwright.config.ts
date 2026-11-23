import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const SERVER_PORT = 4100;
const isCI = Boolean(process.env.CI);

/**
 * E2E tests run against a production build (in `test` mode, which adds the
 * `window.__driftnote` test hooks) served by the real sync server, so the app, `/api` and
 * `/sync` share one origin, as in production (ADR 009, ADR 010). Each browser context is a
 * separate user.
 */
export default defineConfig({
  testDir: "./e2e",
  // Screenshot capture (`pnpm shots`, SHOTS=1) and README demo recording (`pnpm demo`,
  // DEMO=1) only run on request.
  ...(process.env.SHOTS
    ? { grep: /@shots/ }
    : process.env.DEMO
      ? { grep: /@demo/ }
      : { grepInvert: /@shots|@demo/ }),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${SERVER_PORT}`,
    trace: "retain-on-failure",
    // A stuck action fails fast with a clear error instead of consuming the whole test
    // timeout (a timeout is not a "failure", so it would also break `test.fail()`).
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    // Each fresh context would otherwise install the service worker and download the whole
    // precache (~5 MB). Only the offline tests need it; they opt in with
    // `test.use({ serviceWorkers: "allow" })`.
    serviceWorkers: "block",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm exec vite build --mode test && pnpm --filter @driftnote/sync-server start",
    url: `http://127.0.0.1:${SERVER_PORT}/healthz`,
    env: {
      PORT: String(SERVER_PORT),
      STATIC_DIR: resolve(import.meta.dirname, "dist"),
      // Short save delay so "synced" (which waits for the server's save) comes quickly.
      SAVE_DEBOUNCE_MS: "300",
      // A fresh database per run, so runs never share state.
      DATABASE_PATH: join(tmpdir(), `driftnote-e2e-${String(Date.now())}.sqlite`),
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
