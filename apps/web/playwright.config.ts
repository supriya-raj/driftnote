import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 4173;
const SERVER_PORT = 4100;
const isCI = Boolean(process.env["CI"]);

/**
 * E2E tests run against a production build of the web app plus the real sync server
 * (ADR 009). Each browser context is a separate user.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "pnpm --filter @driftnote/sync-server start",
      url: `http://127.0.0.1:${SERVER_PORT}/healthz`,
      env: { PORT: String(SERVER_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
