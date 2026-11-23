import type { BrowserContext, Page, WebSocketRoute } from "@playwright/test";

export const syncStatus = (page: Page) => page.getByTestId("sync-status");

/**
 * Controls whether pages can reach the sync server. Uses Playwright's WebSocket routing
 * (whether `context.setOffline` cuts WebSockets in every browser is spike S40's question).
 * `block()` closes the open sync connections and refuses new ones, like a dead network;
 * `unblock()` lets new connections through to the real server.
 */
export async function controlSyncNetwork(
  target: Page | BrowserContext,
): Promise<{ block(): void; unblock(): void }> {
  let blocked = false;
  const open = new Set<WebSocketRoute>();
  await target.routeWebSocket(/\/sync\//, async (ws) => {
    if (blocked) {
      await ws.close();
      return;
    }
    open.add(ws);
    ws.onClose(() => open.delete(ws));
    ws.connectToServer();
  });
  return {
    block: () => {
      blocked = true;
      for (const ws of open) void ws.close();
      open.clear();
    },
    unblock: () => (blocked = false),
  };
}
