import { expect, test, type Page } from "@playwright/test";
import { describeFocus, expectFocusVisible, pressTab, tabTo } from "./support/keyboard";
import { createNote, editorBody } from "./support/notes";
import { createShareLink } from "./support/share";
import { syncStatus } from "./support/sync";

/**
 * Keyboard and focus behaviour (M5a, T62). Every step uses keys only; `tabTo` fails with
 * the path focus took if a control cannot be reached.
 */

const titleBox = (page: Page) => page.getByRole("textbox", { name: "Title" });
const newNote = (page: Page) => page.getByRole("button", { name: "New note" });

test("@M5a the first Tab offers a skip link that jumps past the note list", async ({ page }) => {
  await createNote(page, { title: "One" });
  await createNote(page, { title: "Two" });
  await page.goto("/");
  await newNote(page).waitFor();

  await pressTab(page);
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible(); // hidden until focused, then shown
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  // On a note, the next Tab after skipping lands in the note, not in the sidebar.
  await page.getByRole("list", { name: "Notes" }).getByRole("link", { name: "One" }).click();
  await expect(titleBox(page)).toHaveValue("One");
  await tabTo(page, skip, { backwards: true });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await pressTab(page);
  const inMain = await page.evaluate(
    () => document.querySelector("main")?.contains(document.activeElement) ?? false,
  );
  expect(inMain, `after skipping, Tab went to ${await describeFocus(page)}`).toBe(true);
});

test("@M5a a new note puts focus on its title, and Enter moves on to the text", async ({
  page,
}) => {
  await page.goto("/");
  await tabTo(page, newNote(page));
  await page.keyboard.press("Enter");
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type("Shopping");
  await page.keyboard.press("Enter");
  await expect(editorBody(page)).toBeFocused();
  await page.keyboard.type("Bread");
  await expect(titleBox(page)).toHaveValue("Shopping"); // Enter did not end up in the title
  await expect(editorBody(page)).toContainText("Bread");
});

// An existing note is opened to read as often as to edit: focus goes to the note itself
// (announced with its title), not into a text field, which on a phone would pop up the
// on-screen keyboard. One Tab reaches the title.
test("@M5a opening a note from the list moves focus to the note, one Tab from its title", async ({
  page,
}) => {
  await createNote(page, { title: "Shopping" });
  await createNote(page, { title: "Other" });
  const link = page.getByRole("list", { name: "Notes" }).getByRole("link", { name: "Shopping" });
  await tabTo(page, link, { backwards: true });
  await page.keyboard.press("Enter");
  await expect(titleBox(page)).toHaveValue("Shopping");
  await expect(page.getByRole("article", { name: "Shopping" })).toBeFocused();
  await pressTab(page);
  await expect(titleBox(page)).toBeFocused();
});

// Tab indents inside the note text, so it cannot be the way out (WCAG 2.1.2, no keyboard
// trap): Escape is, and screen readers are told so.
test("@M5a Escape leaves the note text, where Tab indents; a menu's Escape closes only the menu", async ({
  page,
}) => {
  await page.goto("/");
  await newNote(page).click();
  await expect(titleBox(page)).toBeFocused();
  await page.keyboard.type("Escape hatch");
  await page.keyboard.press("Enter");
  const text = editorBody(page);
  await expect(text).toBeFocused();
  await expect(text).toHaveAccessibleDescription("Tab indents. Press Escape to leave the text.");
  await page.keyboard.type("A line");
  await page.keyboard.press("Enter");
  await page.keyboard.type("A nested line");
  // Plain Tab (in Safari too): it indents under the line above. (The first line has
  // nothing to nest in, and Safari's Option+Tab is not Tab to the editor: both move on.)
  await page.keyboard.press("Tab");
  await expect(text).toBeFocused(); // Tab stayed in the text

  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  const menu = page.getByRole("listbox", { name: "Insert a block" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(text).toBeFocused(); // the first Escape only closed the menu

  await page.keyboard.press("Escape");
  await expect(titleBox(page)).toBeFocused();
  await expect(titleBox(page)).toHaveValue("Escape hatch");
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("@M5a on a phone, opening and leaving a note never loses focus", async ({ page }) => {
    await createNote(page, { title: "Pocket note" });
    await page.goto("/");
    const link = page
      .getByRole("list", { name: "Notes" })
      .getByRole("link", { name: "Pocket note" });
    await tabTo(page, link);
    await page.keyboard.press("Enter"); // the list disappears; the note takes the screen
    await expect(page.getByRole("article", { name: "Pocket note" })).toBeFocused();

    await tabTo(page, page.getByRole("link", { name: "All notes" }), { backwards: true });
    await page.keyboard.press("Enter"); // the note disappears; the list takes the screen
    await expect(page).toHaveURL(/\/$/);
    await expect(newNote(page)).toBeFocused();
    await expectFocusVisible(page, "after going back to the list");
  });

  test("@M5a on a phone's list page there is no skip link (the list is the content)", async ({
    page,
  }) => {
    await page.goto("/");
    await newNote(page).waitFor();
    await pressTab(page);
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeHidden();
    await expect(page.locator("main")).toBeHidden();
  });
});

test("@M5a dialogs take focus, keep it inside, close on Escape and give it back", async ({
  page,
}) => {
  await createNote(page, { title: "Dialogs" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");

  const share = page.getByRole("button", { name: "Share" });
  await tabTo(page, share);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Share/ });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    const where = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "outside the page"; // e.g. the browser's UI
      return el.closest("dialog") ? "dialog" : "page behind the dialog";
    });
    expect(where, `Tab ${String(i)} reached ${await describeFocus(page)}`).not.toBe(
      "page behind the dialog",
    );
    await pressTab(page);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(share).toBeFocused();

  const profile = page.getByRole("button", { name: /^You:/ });
  await tabTo(page, profile);
  await page.keyboard.press("Enter");
  const profileDialog = page.getByRole("dialog", { name: "How others see you" });
  await expect(profileDialog.getByRole("textbox", { name: "Your name" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(profileDialog).toBeHidden();
  await expect(profile).toBeFocused();
});

// Found by a flaky run: a <dialog>'s "close" event arrives later, as its own task, and
// browsers handle key presses first. Escape then a quick Enter on the opener ran as
// "open" (already open) then "closed": the button did nothing. Closing and clicking in one
// synchronous step makes that order certain instead of occasional.
test("@M5a a dialog reopens even when reopened before its close has been handled", async ({
  page,
}) => {
  await createNote(page, { title: "Quick hands" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  for (const [opener, name] of [
    ["Share", /Share/],
    ["You:", "How others see you"],
  ] as const) {
    await page.getByRole("button", { name: opener }).click();
    const dialog = page.getByRole("dialog", { name });
    await expect(dialog).toBeVisible();
    await page.evaluate((label) => {
      const open = document.querySelector<HTMLDialogElement>("dialog[open]");
      const button = [...document.querySelectorAll("button")].find((b) =>
        b.textContent.includes(label),
      );
      open?.close(); // like Escape: its "close" event is only queued
      button?.click(); // like a quick Enter on the opener, handled first
    }, opener);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});

test("@M5a the delete confirmation gives focus back when cancelled", async ({ page }) => {
  await createNote(page, { title: "Keep me" });
  const del = page.getByRole("button", { name: "Delete note" });
  await tabTo(page, del);

  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(del).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Enter"); // Cancel
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(del).toBeFocused();
});

test("@M5a after deleting a note, focus moves to New note", async ({ page }) => {
  await createNote(page, { title: "Doomed" });
  await tabTo(page, page.getByRole("button", { name: "Delete note" }));
  await page.keyboard.press("Enter");
  await pressTab(page);
  await expect(page.getByRole("button", { name: "Yes, delete" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(newNote(page)).toBeFocused();
});

test("@M5a revoking a link keeps focus in the share dialog", async ({ page }) => {
  await createNote(page, { title: "Revocable" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  await createShareLink(page, "view");
  await page.getByRole("button", { name: "Share" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Share/ });
  const revoke = dialog.getByRole("button", { name: "Revoke" });

  await tabTo(page, revoke);
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused(); // the safe choice
  await page.keyboard.press("Enter");
  await expect(revoke).toBeFocused();

  await page.keyboard.press("Enter");
  await tabTo(page, dialog.getByRole("button", { name: "Confirm revoke" }));
  await page.keyboard.press("Enter");
  await expect(dialog.getByText("Revoked", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Links" })).toBeFocused();
});

test("@M5a every stop in the tab order shows a focus ring", async ({ page }) => {
  await createNote(page, { title: "Ring", text: "Some text" });
  await createNote(page, { title: "Another" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  await createShareLink(page, "view"); // so the dialog has a link row too
  for (const where of ["home", "note", "share dialog"] as const) {
    if (where === "home") await page.goto("/");
    if (where === "note") await page.goBack();
    if (where === "share dialog") await page.getByRole("button", { name: "Share" }).click();
    await newNote(page).waitFor();
    // Start at the top of the tab order (in a modal dialog, at the top of the dialog).
    if (where === "share dialog")
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    else await page.getByRole("link", { name: "Skip to main content" }).focus();
    // How every control looks *without* focus, to compare with how it looks focused: a
    // ring must change something (a button's ordinary shadow is not a focus ring).
    await page.evaluate(() => {
      const w = window as unknown as {
        __look: (el: Element) => string;
        __unfocused: Map<Element, string>;
      };
      w.__look = (el) =>
        [getComputedStyle(el), getComputedStyle(el, "::after")] // the note list rings its row
          .map((c) => [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow].join(" "))
          .join(" | ");
      w.__unfocused = new Map();
      for (const el of document.querySelectorAll("a, button, input, [tabindex]")) {
        w.__unfocused.set(el, w.__look(el));
      }
    });
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      await pressTab(page);
      const stop = await page.evaluate(async () => {
        const w = window as unknown as {
          __look: (el: Element) => string;
          __unfocused: Map<Element, string>;
        };
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        // Rings fade in (120ms transitions): measure once they have finished.
        await Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => undefined)),
        );
        const before = w.__unfocused.get(el);
        return { changed: before !== undefined && before !== w.__look(el) };
      });
      if (!stop) break; // left the page
      const label = await describeFocus(page);
      if (seen.has(label)) break; // wrapped around
      seen.add(label);
      // The note's title and text show focus with the blinking caret instead of a ring
      // around a page-wide field (docs/DESIGN.md).
      if (label.startsWith('<div> "Note text"') || label.startsWith('<input> "Title"')) continue;
      await expectFocusVisible(page, `on ${where}`);
      expect(stop.changed, `focusing changes nothing visible on ${where}: ${label}`).toBe(true);
    }
    expect(seen.size, `tab stops found on ${where}: ${[...seen].join(", ")}`).toBeGreaterThan(3);
  }
});
