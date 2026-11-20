import { expect, test } from "@playwright/test";
import { createNote, listedTitles } from "./support/notes";
import { waitForOfflineReady } from "./support/offline";

// These tests need the service worker (blocked by default in playwright.config.ts).
test.use({ serviceWorkers: "allow" });

test("@M1 the home page loads offline after one visit", async ({ page, context }) => {
  await createNote(page, { title: "Offline list" });
  await page.goto("/");
  await waitForOfflineReady(page);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole("heading", { level: 1, name: "Driftnote" })).toBeVisible();
  await expect.poll(() => listedTitles(page)).toEqual(["Offline list"]);
});

test("@M1 a note page loads offline, even when opened directly", async ({ page, context }) => {
  const noteUrl = await createNote(page, { title: "Trip", text: "Pack the tent" });
  await waitForOfflineReady(page);

  await context.setOffline(true);
  // A fresh navigation to a deep link (not a reload) needs the SPA fallback.
  await page.goto("about:blank");
  await page.goto(noteUrl);

  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Trip");
  await expect(page.getByTestId("note-editor")).toContainText("Pack the tent");
});
