import { expect, type Page } from "@playwright/test";

/** Creates a note from the home page, optionally titles it and types into it. */
export async function createNote(
  page: Page,
  options: { title?: string; text?: string } = {},
): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page).toHaveURL(/\/n\/[A-Za-z0-9_-]{21}$/);
  if (options.title !== undefined) {
    await page.getByRole("textbox", { name: "Title" }).fill(options.title);
  }
  if (options.text !== undefined) {
    await editorBody(page).click();
    await page.keyboard.type(options.text);
  }
  await waitForLocalSave(page);
  return page.url();
}

export function editorBody(page: Page) {
  return page.getByTestId("note-editor").locator("[contenteditable]");
}

/** Waits until every change is in IndexedDB, so a reload cannot race the save. */
export async function waitForLocalSave(page: Page): Promise<void> {
  await expect(page.getByTestId("note-editor")).toHaveAttribute("data-local-state", "saved");
}

/** Titles shown in the home page note list, in display order. */
export async function listedTitles(page: Page): Promise<string[]> {
  const list = page.getByRole("list", { name: "Notes" });
  await expect(list).toBeVisible();
  return list.getByRole("link").allTextContents();
}
