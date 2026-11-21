import { test as base, type Page } from "@playwright/test";

/**
 * Adds `bob`: a second person, i.e. a page in a separate browser context (no shared
 * storage, cookies or tokens with `page`). Closed automatically after the test.
 */
export const test = base.extend<{ bob: Page }>({
  bob: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(await context.newPage());
    await context.close();
  },
});

export { expect } from "@playwright/test";
