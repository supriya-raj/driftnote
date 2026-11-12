import { defineConfig } from "vitest/config";

// Test layers (ADR 009): integration tests are the main layer for the server;
// unit tests exist only for a couple of pure functions.
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["apps/sync-server/test/**/*.int.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
