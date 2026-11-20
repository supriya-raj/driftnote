import { expect, test, type Page } from "@playwright/test";

async function createNoteAndType(page: Page, text: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page).toHaveURL(/\/n\/[A-Za-z0-9_-]{21}$/);
  await page.getByTestId("note-editor").locator("[contenteditable=true]").click();
  await page.keyboard.type(text);
}

test("@M1 a new note keeps its content after a reload", async ({ page }) => {
  await createNoteAndType(page, "Remember the milk");
  const editor = page.getByTestId("note-editor");
  await expect(editor).toHaveAttribute("data-local-state", "saved");
  const noteUrl = page.url();

  await page.reload();

  expect(page.url()).toBe(noteUrl);
  await expect(page.getByTestId("note-editor")).toContainText("Remember the milk");
});

test("@M1 two new notes are separate documents", async ({ page }) => {
  await createNoteAndType(page, "First note");
  await expect(page.getByTestId("note-editor")).toHaveAttribute("data-local-state", "saved");
  const firstUrl = page.url();

  await createNoteAndType(page, "Second note");
  await expect(page.getByTestId("note-editor")).toHaveAttribute("data-local-state", "saved");
  expect(page.url()).not.toBe(firstUrl);
  await expect(page.getByTestId("note-editor")).not.toContainText("First note");

  await page.goto(firstUrl);
  await expect(page.getByTestId("note-editor")).toContainText("First note");
  await expect(page.getByTestId("note-editor")).not.toContainText("Second note");
});

test("@M1 the slash menu offers text blocks but no media blocks", async ({ page }) => {
  await createNoteAndType(page, "/");

  const menu = page.getByRole("listbox");
  // Sanity check: the menu is open and lists normal blocks, so the absence checks below
  // cannot pass just because no menu appeared.
  await expect(menu.getByRole("option", { name: /^Heading 1/ })).toBeVisible();
  await expect(menu.getByRole("option", { name: /^Table/ })).toBeVisible();

  for (const media of ["Image", "Video", "Audio", "File"]) {
    await expect(menu.getByRole("option", { name: new RegExp(`^${media}\\b`) })).toHaveCount(0);
  }
});
