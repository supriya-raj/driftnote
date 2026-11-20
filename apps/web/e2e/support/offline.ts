import type { Page } from "@playwright/test";

/**
 * Waits until the service worker is active and controlling the page, i.e. the app shell
 * is cached and a reload would work without a network.
 */
export async function waitForOfflineReady(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === "activated" && navigator.serviceWorker.controller;
  });
}
