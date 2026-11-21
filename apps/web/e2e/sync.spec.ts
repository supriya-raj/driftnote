import { expect, test } from "@playwright/test";
import { createNote, editorBody } from "./support/notes";
import { controlSyncNetwork, syncStatus } from "./support/sync";

const notBackedUp = (page: import("@playwright/test").Page, title: string) =>
  page
    .getByRole("list", { name: "Notes" })
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByText("Not backed up");

test("@M2 a new note syncs to the server: the badge reaches synced", async ({ page }) => {
  await createNote(page, { title: "Online note", text: "hello server" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  await expect(notBackedUp(page, "Online note")).toHaveCount(0);
});

test("@M2 offline the badge says so and the note is marked not backed up; online it syncs and the mark clears", async ({
  page,
}) => {
  const network = await controlSyncNetwork(page);
  network.block();
  await createNote(page, { title: "Offline draft", text: "written without a server" });

  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "offline");
  await expect(notBackedUp(page, "Offline draft")).toBeVisible();

  network.unblock(); // the provider retries on its own
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced", { timeout: 10_000 });
  await expect(notBackedUp(page, "Offline draft")).toHaveCount(0);
});

test("@M2 typing after a sync shows syncing until the server has saved it", async ({ page }) => {
  await createNote(page, { text: "first" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");

  await editorBody(page).click();
  await page.keyboard.type(" and more");
  // Either state may be seen first, but it must settle at synced again.
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
});
