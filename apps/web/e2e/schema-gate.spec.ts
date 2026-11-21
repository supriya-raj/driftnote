import { expect, test, type Page } from "@playwright/test";
import { createNote, editorBody, waitForLocalSave } from "./support/notes";

const gateMessage = (page: Page) => page.getByRole("alert").filter({ hasText: "newer version" });

test("@M1 a note from a newer app version opens read-only", async ({ page }) => {
  await createNote(page, { title: "From the future", text: "Original text" });

  await page.evaluate(() => window.__driftnote?.setSchemaVersion(99));

  await expect(gateMessage(page)).toBeVisible();
  await expect(editorBody(page)).toHaveAttribute("contenteditable", "false");
  await expect(page.getByRole("textbox", { name: "Title" })).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Delete note" })).toBeVisible(); // still deletable

  await editorBody(page).click();
  await page.keyboard.type("should not appear");
  await expect(page.getByTestId("note-editor")).not.toContainText("should not appear");
});

test("@M1 the read-only gate survives a reload", async ({ page }) => {
  await createNote(page, { text: "Original text" });
  await page.evaluate(() => window.__driftnote?.setSchemaVersion(2));
  await waitForLocalSave(page);

  await page.reload();

  await expect(gateMessage(page)).toBeVisible();
  await expect(editorBody(page)).toHaveAttribute("contenteditable", "false");
  await expect(page.getByTestId("note-editor")).toContainText("Original text");
});

test("@M1 a note at the supported version stays editable", async ({ page }) => {
  await createNote(page, { text: "Today" });
  await page.evaluate(() => window.__driftnote?.setSchemaVersion(1));

  await expect(editorBody(page)).toHaveAttribute("contenteditable", "true");
  await expect(gateMessage(page)).toHaveCount(0);
});

// S20 finding: the editor deletes block types it does not know from the shared document,
// even when it is not editable. A gated note must never let that deletion be stored.
test("@M1 a gated note never deletes content this app cannot display", async ({ page }) => {
  await createNote(page, { text: "Original text" });
  await page.evaluate(() => window.__driftnote?.setSchemaVersion(2));
  await expect(gateMessage(page)).toBeVisible();

  await page.evaluate(() => window.__driftnote?.injectBlock("callout", "From a newer app"));

  // Still visible content updates arrive in the read-only view...
  await page.evaluate(() => window.__driftnote?.injectBlock("paragraph", "A later paragraph"));
  await expect(page.getByTestId("note-editor")).toContainText("A later paragraph");
  // ...and the block it cannot display is still stored, not deleted.
  await expect
    .poll(() => page.evaluate(() => window.__driftnote?.storedContent() ?? ""))
    .toContain("From a newer app");

  await waitForLocalSave(page);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.__driftnote?.storedContent() ?? ""))
    .toContain("From a newer app");
});
