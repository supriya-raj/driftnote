import { expect, test, type Page } from "@playwright/test";
import { createNote, listedTitles } from "./support/notes";

async function noteDatabaseNames(page: Page): Promise<string[]> {
  return page.evaluate(async () =>
    (await indexedDB.databases())
      .map((d) => d.name ?? "")
      .filter((n) => n.startsWith("driftnote-note-")),
  );
}

test("@M1 deleting a note removes it from the list and from this browser", async ({ page }) => {
  await createNote(page, { title: "Keep me", text: "stays" });
  const doomedUrl = await createNote(page, { title: "Delete me", text: "goes" });
  expect(await noteDatabaseNames(page)).toHaveLength(2);

  await page.getByRole("button", { name: "Delete note" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => listedTitles(page)).toEqual(["Keep me"]);
  expect(await noteDatabaseNames(page)).toHaveLength(1);

  await page.goto(doomedUrl);
  await expect(page.getByRole("heading", { name: "Note not found" })).toBeVisible();
  await expect(page.getByTestId("note-editor")).toHaveCount(0);
});

test("@M1 cancelling a delete keeps the note", async ({ page }) => {
  await createNote(page, { title: "Still here" });

  await page.getByRole("button", { name: "Delete note" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Still here");
  await page.goto("/");
  await expect.poll(() => listedTitles(page)).toEqual(["Still here"]);
});

test("@M1 an unknown note shows 'not found' without creating anything", async ({ page }) => {
  await page.goto("/n/AAAAAAAAAAAAAAAAAAAAA"); // valid shape, never created
  await expect(page.getByRole("heading", { name: "Note not found" })).toBeVisible();

  await page.goto("/n/not-a-note-id");
  await expect(page.getByRole("heading", { name: "Note not found" })).toBeVisible();

  expect(await noteDatabaseNames(page)).toEqual([]);
});
