import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { expectFocusVisible, pressTab, tabTo } from "./support/keyboard";
import { editorBody } from "./support/notes";
import { syncStatus } from "./support/sync";

// M5a "done when": the core flow works with the keyboard alone (focus always visible,
// never lost), and axe finds no WCAG 2.2 AA violations on any screen on the way.
// Written as expected-to-fail in T60; a normal test since T62, which made it pass.

test("@M5a-done the core flow works with the keyboard alone and every screen passes axe", async ({
  page,
}) => {
  test.setTimeout(60_000); // one long journey with five axe scans (each 1-3 s in Firefox)
  const notesList = page.getByRole("list", { name: "Notes" });

  // Home: start a note.
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).waitFor();
  await expectAccessible(page, "home, no notes");
  await tabTo(page, page.getByRole("button", { name: "New note" }));
  await expectFocusVisible(page, "on New note");
  await page.keyboard.press("Enter");

  // The new note: focus goes to the title, Enter moves on to the text.
  await expect(page).toHaveURL(/\/n\/[A-Za-z0-9_-]{21}$/);
  await expect(page.getByRole("textbox", { name: "Title" })).toBeFocused();
  await page.keyboard.type("Keyboard plan");
  await page.keyboard.press("Enter");
  await expect(editorBody(page)).toBeFocused();
  await page.keyboard.type("Written without a mouse.");
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  await expectAccessible(page, "note");

  // Share: the dialog takes focus, a link can be created and copied, Escape returns focus.
  const share = page.getByRole("button", { name: "Share" });
  await tabTo(page, share);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Share/ });
  await expect(dialog).toBeVisible();
  await tabTo(page, dialog.getByRole("button", { name: "Create edit link" }));
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("textbox", { name: "Edit link" })).toHaveValue(/#t=/);
  await expectFocusVisible(page, "after creating a link");
  await expectAccessible(page, "share dialog with a link");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(share).toBeFocused();

  // A second note, then back to the first one from the list, and rename it.
  await tabTo(page, page.getByRole("button", { name: "New note" }), { backwards: true });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Title" })).toBeFocused();
  await page.keyboard.type("Second");
  await expect(notesList.getByRole("link", { name: "Second" })).toBeVisible();
  await expectAccessible(page, "note list with two notes");

  await tabTo(page, notesList.getByRole("link", { name: "Keyboard plan" }), { backwards: true });
  await expectFocusVisible(page, "on a note in the list");
  await page.keyboard.press("Enter");
  const title = page.getByRole("textbox", { name: "Title" });
  await expect(title).toHaveValue("Keyboard plan");
  // An existing note takes focus itself (no on-screen keyboard on phones); Tab → title.
  await expect(page.getByRole("article", { name: "Keyboard plan" })).toBeFocused();
  await pressTab(page);
  await expect(title).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Keyboard plan, renamed");
  await expect(notesList.getByRole("link", { name: "Keyboard plan, renamed" })).toBeVisible();

  // Delete it: the confirmation takes focus on the safe choice; after deleting, focus is
  // not lost.
  await tabTo(page, page.getByRole("button", { name: "Delete note" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expectAccessible(page, "delete confirmation");
  await pressTab(page);
  await expect(page.getByRole("button", { name: "Yes, delete" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(notesList.getByRole("link")).toHaveText(["Second"]);
  await expectFocusVisible(page, "after deleting a note");
  await expectAccessible(page, "home after deleting");
});
