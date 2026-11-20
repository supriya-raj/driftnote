import { expect, test } from "@playwright/test";
import { createNote, listedTitles, waitForLocalSave } from "./support/notes";

test("@M1 the note list shows titles, most recent first", async ({ page }) => {
  await createNote(page, { title: "Groceries" });
  await createNote(page, { title: "Ideas" });
  await createNote(page, {}); // no title yet

  await page.goto("/");
  await expect.poll(() => listedTitles(page)).toEqual(["Untitled", "Ideas", "Groceries"]);
});

test("@M1 a renamed note shows its new title after a reload", async ({ page }) => {
  const url = await createNote(page, { title: "Draft" });

  await page.getByRole("textbox", { name: "Title" }).fill("Final plan");
  await waitForLocalSave(page);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Final plan");

  await page.goto("/");
  await expect.poll(() => listedTitles(page)).toEqual(["Final plan"]);
  await page.getByRole("link", { name: "Final plan" }).click();
  await expect(page).toHaveURL(url);
});

test("@M1 a cleared note list is rebuilt identically from the notes", async ({ page }) => {
  await createNote(page, { title: "Alpha", text: "first" });
  await createNote(page, { title: "Beta", text: "second" });
  await page.goto("/");
  await expect.poll(() => listedTitles(page)).toEqual(["Beta", "Alpha"]);
  const linksBefore = await page.getByRole("list", { name: "Notes" }).getByRole("link").all();
  const hrefsBefore = await Promise.all(linksBefore.map((l) => l.getAttribute("href")));

  await page.evaluate(() => window.__driftnote?.clearNoteList());
  await page.reload();

  await expect.poll(() => listedTitles(page)).toEqual(["Beta", "Alpha"]);
  const linksAfter = await page.getByRole("list", { name: "Notes" }).getByRole("link").all();
  expect(await Promise.all(linksAfter.map((l) => l.getAttribute("href")))).toEqual(hrefsBefore);
});
