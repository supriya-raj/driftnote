import { expect, test, type Page } from "@playwright/test";

/**
 * Replaces the browser's storage-persistence API before the app starts, so each test
 * decides the browser's answer. Records whether the app asked.
 */
async function stubPersistence(
  page: Page,
  answers: { alreadyPersisted: boolean; grant: boolean },
): Promise<void> {
  await page.addInitScript((a) => {
    const w = window as unknown as { __persistRequested: boolean };
    w.__persistRequested = false;
    navigator.storage.persisted = () => Promise.resolve(a.alreadyPersisted);
    navigator.storage.persist = () => {
      w.__persistRequested = true;
      return Promise.resolve(a.grant);
    };
  }, answers);
}

const warning = (page: Page) => page.getByRole("alert").filter({ hasText: "may be deleted" });

test("@M1 a warning is shown when the browser refuses persistent storage", async ({ page }) => {
  await stubPersistence(page, { alreadyPersisted: false, grant: false });
  await page.goto("/");
  await expect(warning(page)).toBeVisible();
});

test("@M1 no warning when the browser grants persistent storage", async ({ page }) => {
  await stubPersistence(page, { alreadyPersisted: false, grant: true });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __persistRequested: boolean }).__persistRequested,
      ),
    )
    .toBe(true);
  await expect(warning(page)).toHaveCount(0);
});

test("@M1 storage that is already persistent is not requested again", async ({ page }) => {
  await stubPersistence(page, { alreadyPersisted: true, grant: false });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Driftnote" })).toBeVisible();
  await expect(warning(page)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { __persistRequested: boolean }).__persistRequested,
    ),
  ).toBe(false);
});
