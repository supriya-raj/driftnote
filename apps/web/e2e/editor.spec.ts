import { expect, test } from "@playwright/test";
import { createNote, editorBody } from "./support/notes";

test("@M1 a new note keeps its content after a reload", async ({ page }) => {
  const noteUrl = await createNote(page, { text: "Remember the milk" });

  await page.reload();

  expect(page.url()).toBe(noteUrl);
  await expect(page.getByTestId("note-editor")).toContainText("Remember the milk");
});

test("@M1 two new notes are separate documents", async ({ page }) => {
  const firstUrl = await createNote(page, { text: "First note" });
  const secondUrl = await createNote(page, { text: "Second note" });

  expect(secondUrl).not.toBe(firstUrl);
  await expect(page.getByTestId("note-editor")).not.toContainText("First note");

  await page.goto(firstUrl);
  await expect(page.getByTestId("note-editor")).toContainText("First note");
  await expect(page.getByTestId("note-editor")).not.toContainText("Second note");
});

test("@M1 the slash menu offers text blocks but no media blocks", async ({ page }) => {
  await createNote(page);
  await editorBody(page).click();
  await page.keyboard.type("/");

  const menu = page.getByRole("listbox");
  // Sanity check: the menu is open and lists normal blocks, so the absence checks below
  // cannot pass just because no menu appeared.
  await expect(menu.getByRole("option", { name: /^Heading 1/ })).toBeVisible();
  await expect(menu.getByRole("option", { name: /^Table/ })).toBeVisible();

  for (const media of ["Image", "Video", "Audio", "File"]) {
    await expect(menu.getByRole("option", { name: new RegExp(`^${media}\\b`) })).toHaveCount(0);
  }
});
