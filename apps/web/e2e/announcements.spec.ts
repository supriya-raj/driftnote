import { expect, test, type Page } from "@playwright/test";
import { createNote, editorBody } from "./support/notes";
import { createShareLink } from "./support/share";
import { controlSyncNetwork, syncStatus } from "./support/sync";

/**
 * What a screen reader user hears and can navigate by (M5a, T63): page structure, names,
 * and announcements for changes that happen without focus moving (live regions).
 */

/** The page's live region. While a modal dialog is open, everything outside it is hidden
 *  from assistive technology, so dialogs have their own (`dialog.locator(...)` below). */
const announcer = (page: Page) => page.locator('[data-announcer="page"]');

test("@M5a page structure: one h1, named landmarks, and the open note is a heading", async ({
  page,
}) => {
  await createNote(page, { title: "Structure", text: "Body" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Note navigation" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 2, name: "Structure" })).toBeAttached();
  await expect(main.getByRole("article", { name: "Structure" })).toBeAttached();

  // The heading follows renames, like the list does.
  await page.getByRole("textbox", { name: "Title" }).fill("Renamed");
  await expect(main.getByRole("heading", { level: 2, name: "Renamed" })).toBeAttached();
});

test("@M5a going offline and back online is announced, but ordinary saving is not", async ({
  page,
}) => {
  const network = await controlSyncNetwork(page);
  await createNote(page, { title: "Connection" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");

  await editorBody(page).click();
  await page.keyboard.type("Typing online");
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  await expect(announcer(page)).toHaveText(""); // syncing → synced on every edit: silent

  network.block();
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "offline");
  await expect(announcer(page)).toHaveText(/offline.*saved in this browser/i);

  network.unblock();
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  await expect(announcer(page)).toHaveText(/back online.*synced/i);
});

test("@M5a creating, copying and revoking a link is announced inside the dialog", async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await createNote(page, { title: "Announce links" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: /Share/ });
  const status = dialog.locator("[data-announcer]");

  await dialog.getByRole("button", { name: "Create view link" }).click();
  await expect(status).toHaveText(/view link created/i);

  await dialog.getByRole("button", { name: "Copy" }).first().click();
  // Copied, or (where the clipboard is blocked) left selected with how to copy it.
  await expect(status).toHaveText(/link copied|press (ctrl|cmd)\+c/i);

  await dialog.getByRole("button", { name: "Revoke" }).click();
  await dialog.getByRole("button", { name: "Confirm revoke" }).click();
  await expect(status).toHaveText(/link revoked/i);
});

test("@M5a deleting a note is announced", async ({ page }) => {
  await createNote(page, { title: "Gone soon" });
  await page.getByRole("button", { name: "Delete note" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(announcer(page)).toHaveText(/“Gone soon” deleted/);
});

test("@M5a the delete confirmation's explanation is read with it", async ({ page }) => {
  await createNote(page, { title: "Described" });
  await page.getByRole("button", { name: "Delete note" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this note?" });
  await expect(confirm).toHaveAccessibleDescription(/removed from this browser/);
});

test("@M5a profile colours have names, not codes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^You:/ }).click();
  const dialog = page.getByRole("dialog", { name: "How others see you" });
  const radios = dialog.getByRole("radio");
  await expect(radios).toHaveCount(8);
  for (const name of ["Blue", "Teal", "Green", "Pink", "Purple", "Red", "Amber", "Indigo"]) {
    await expect(dialog.getByRole("radio", { name })).toHaveCount(1);
  }
});

test("@M5a everyone present is named, including those behind “+N”", async ({ page, browser }) => {
  test.setTimeout(test.info().timeout * 2); // six people
  await createNote(page, { title: "Crowded" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  const link = await createShareLink(page, "view");
  const names = ["Ana", "Ben", "Cleo", "Dev", "Eli"];
  const contexts = await Promise.all(names.map(() => browser.newContext()));
  await Promise.all(
    contexts.map(async (context, i) => {
      const guest = await context.newPage();
      await guest.addInitScript((name) => {
        localStorage.setItem("driftnote.identity", JSON.stringify({ name, color: "#3e63dd" }));
      }, names[i] ?? "");
      await guest.goto(link);
      await editorBody(guest).waitFor();
    }),
  );
  const people = page.getByRole("list", { name: "People here" });
  for (const name of names) await expect(people).toContainText(name);
  await Promise.all(contexts.map((c) => c.close()));
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("@M5a with reduced motion, dialogs and popovers appear without animating", async ({
    page,
  }) => {
    await createNote(page, { title: "Still" });
    await page.getByRole("button", { name: "Delete note" }).click();
    const popover = page.getByRole("alertdialog");
    await expect(popover).toBeVisible();
    const durations = await popover.evaluate((el) =>
      el.getAnimations().map((a) => a.effect?.getComputedTiming().duration),
    );
    expect(durations.every((d) => d === 0)).toBe(true);
  });
});
