import { expect, test } from "@playwright/test";
import { waitForOfflineReady } from "./support/offline";

// These tests need the service worker (blocked by default in playwright.config.ts).
test.use({ serviceWorkers: "allow" });

// M1 "done when": a note created in the browser survives going offline and reloading.
// Written as expected-to-fail in T10; switched to a normal test in T14, which made it pass.
test("@M1-done a note created offline-first survives an offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).click();

  const editor = page.getByTestId("note-editor");
  await editor.locator("[contenteditable=true]").click();
  await page.keyboard.type("Hello from an offline-first note");

  // Wait until the change is written to IndexedDB, so the reload cannot race the save.
  await expect(editor).toHaveAttribute("data-local-state", "saved");
  const noteUrl = page.url();
  // The app shell must be cached before the network goes away (one online visit).
  await waitForOfflineReady(page);

  await context.setOffline(true);
  await page.reload();

  expect(page.url()).toBe(noteUrl);
  await expect(page.getByTestId("note-editor")).toContainText("Hello from an offline-first note");
});
