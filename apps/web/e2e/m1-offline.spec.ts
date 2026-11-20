import { expect, test } from "@playwright/test";

// M1 "done when": a note created in the browser survives going offline and reloading.
// Expected to fail until the milestone is complete (switched to a normal test in T18).
test("@M1-done a note created offline-first survives an offline reload", async ({
  page,
  context,
}) => {
  test.fail();

  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).click();

  const editor = page.getByTestId("note-editor");
  await editor.locator("[contenteditable=true]").click();
  await page.keyboard.type("Hello from an offline-first note");

  // Wait until the change is written to IndexedDB, so the reload cannot race the save.
  await expect(editor).toHaveAttribute("data-local-state", "saved");
  const noteUrl = page.url();

  await context.setOffline(true);
  await page.reload();

  expect(page.url()).toBe(noteUrl);
  await expect(page.getByTestId("note-editor")).toContainText("Hello from an offline-first note");
});
