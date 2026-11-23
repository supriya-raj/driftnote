import { test as base, type Page } from "@playwright/test";

/**
 * Adds `bob`: a second person, i.e. a page in a separate browser context (no shared
 * storage, cookies or tokens with `page`). Closed automatically after the test.
 *
 * Tests with two people drive two browsers, so their total time budget is doubled
 * (seen on a heavily loaded machine in Firefox). Each step keeps its own short limit
 * (actionTimeout, expect timeout), so a stuck step still fails fast with a clear message.
 */
export const test = base.extend<{ bob: Page }>({
  bob: async ({ browser }, use, testInfo) => {
    testInfo.setTimeout(testInfo.timeout * 2);
    const context = await browser.newContext();
    await use(await context.newPage());
    await context.close();
  },
});

export { expect } from "@playwright/test";
