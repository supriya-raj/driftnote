import type { Page } from "@playwright/test";

export const syncStatus = (page: Page) => page.getByTestId("sync-status");

/**
 * Controls whether the page can reach the sync server. Uses Playwright's WebSocket routing
 * (whether `context.setOffline` cuts WebSockets in every browser is spike S40's question).
 * While blocked, every sync connection is closed at once, like a dead network; once
 * unblocked, connections go through to the real server.
 */
export async function controlSyncNetwork(page: Page): Promise<{ block(): void; unblock(): void }> {
  let blocked = false;
  await page.routeWebSocket(/\/sync\//, async (ws) => {
    if (blocked) await ws.close();
    else ws.connectToServer();
  });
  return {
    block: () => (blocked = true),
    unblock: () => (blocked = false),
  };
}
