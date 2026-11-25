import { expect, test, type Browser, type Page } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createNote, editorBody, waitForLocalSave } from "./support/notes";
import { createShareLink } from "./support/share";
import { controlSyncNetwork, syncStatus } from "./support/sync";

/**
 * axe (WCAG 2.2 AA) on every screen and state the app has, in both colour schemes and at
 * desktop and phone width (contrast and layout differ in each). Scans are soft: a test
 * reports every screen it visits, not only the first one with a problem.
 */
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
} as const;

const scan = (page: Page, screen: string) => expectAccessible(page, screen, { soft: true });

/** A note with the block types people use: heading, list, link, paragraph. */
async function richNote(page: Page): Promise<string> {
  const url = await createNote(page, { title: "Trip to Lisbon" });
  await editorBody(page).click();
  await page.keyboard.type("# Plan\n");
  await page.keyboard.type("Three days in late spring.\n");
  await page.keyboard.type("- Tram tour\nMiradouro da Graça\n\n");
  await page.evaluate(() => window.__driftnote?.injectLink("Travel guide", "https://example.com"));
  await waitForLocalSave(page);
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  return url;
}

// Backs the one axe exception (support/a11y.ts): the slash menu has no focusable content,
// yet every item in it can be reached, seen and chosen from the keyboard.
test("@M5a the slash menu is keyboard-reachable to its last item, scrolled into view", async ({
  page,
}) => {
  await createNote(page, { text: "First line" });
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  const menu = page.getByRole("listbox", { name: "Insert a block" });
  const options = menu.getByRole("option");
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  expect(count).toBeGreaterThan(8); // long enough to scroll

  for (let i = 1; i < count; i++) await page.keyboard.press("ArrowDown");
  const last = options.nth(count - 1);
  await expect(last).toHaveAttribute("aria-selected", "true");
  const lastId = await last.getAttribute("id");
  await expect(editorBody(page)).toHaveAttribute("aria-activedescendant", lastId ?? "");
  // Scrolled into view inside the menu, not just present in the DOM.
  const inside = await last.evaluate((item) => {
    const box = item.getBoundingClientRect();
    const menuBox = item.closest('[role="listbox"]')?.getBoundingClientRect();
    return !!menuBox && box.top >= menuBox.top - 1 && box.bottom <= menuBox.bottom + 1;
  });
  expect(inside).toBe(true);

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

// Colours arrive from other people's browsers and can be anything; avatar initials must
// stay readable on them.
test("@M5a avatar initials stay readable on any colour another person picks", async ({
  page,
  browser,
}) => {
  await createNote(page, { title: "Colours" });
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
  const link = await createShareLink(page, "edit");
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await bob.addInitScript(() => {
    // A pale yellow, not in the app's palette: white initials would be unreadable on it.
    localStorage.setItem(
      "driftnote.identity",
      JSON.stringify({ name: "Bob Rivera", color: "#f5d90a" }),
    );
  });
  await bob.goto(link);
  await editorBody(bob).waitFor();
  await page.getByRole("list", { name: "People here" }).getByText("Bob Rivera").waitFor();
  await expectAccessible(page, "another person with a pale colour");
  await bobContext.close();
});

for (const scheme of ["light", "dark"] as const) {
  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`${scheme} ${device}`, () => {
      test.use({ colorScheme: scheme, viewport });
      const newPerson = (browser: Browser) => browser.newContext({ colorScheme: scheme, viewport });

      test(`@M5a axe ${scheme} ${device}: home, note list, profile, warnings`, async ({ page }) => {
        // The browser refuses persistent storage, so the storage warning shows.
        await page.addInitScript(() => {
          StorageManager.prototype.persisted = () => Promise.resolve(false);
          StorageManager.prototype.persist = () => Promise.resolve(false);
        });
        await page.goto("/");
        await page.getByRole("button", { name: "New note" }).waitFor();
        await page.getByRole("alert").filter({ hasText: "may be deleted" }).waitFor();
        await scan(page, "home, no notes, storage warning");

        await createNote(page, { title: "Groceries", text: "Oat milk" });
        await createNote(page, { text: "Untitled thought" });
        await page.goto("/");
        await page.getByRole("list", { name: "Notes" }).waitFor();
        await scan(page, "home with notes");

        await page.evaluate(() => window.__driftnote?.showUpdatePrompt());
        await page.getByRole("status").filter({ hasText: "new version" }).waitFor();
        await scan(page, "update prompt");

        await page.getByRole("button", { name: /^You:/ }).click();
        await page.getByRole("dialog", { name: "How others see you" }).waitFor();
        await scan(page, "profile dialog");
      });

      test(`@M5a axe ${scheme} ${device}: note, editor menus, delete, read-only`, async ({
        page,
      }) => {
        await richNote(page);
        await scan(page, "note");

        await editorBody(page).getByText("Three days").click();
        await page.keyboard.press("End");
        await page.keyboard.press("Shift+Home");
        await page.locator(".bn-formatting-toolbar").waitFor();
        await scan(page, "formatting toolbar");

        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        await page.keyboard.type("/");
        await page.getByRole("listbox").waitFor();
        await scan(page, "slash menu");
        await page.keyboard.press("Escape");

        await page.getByRole("button", { name: "Delete note" }).click();
        await page.getByRole("alertdialog").waitFor();
        await scan(page, "delete confirmation");
        await page.getByRole("button", { name: "Cancel" }).click();

        await page.evaluate(() => window.__driftnote?.setSchemaVersion(99));
        await page.getByRole("alert").filter({ hasText: "Read-only" }).waitFor();
        await scan(page, "read-only (newer version)");
      });

      test(`@M5a axe ${scheme} ${device}: sharing, presence, view only, revoked`, async ({
        page,
        browser,
      }) => {
        test.setTimeout(test.info().timeout * 2); // two people
        await richNote(page);
        await page.getByRole("button", { name: "Share" }).click();
        const share = page.getByRole("dialog", { name: /Share/ });
        await scan(page, "share dialog, no links");
        await share.getByRole("button", { name: "Create edit link" }).click();
        const editLink = await share
          .getByRole("textbox", { name: "Edit link", exact: true })
          .inputValue();
        await share.getByRole("button", { name: "Create view link" }).click();
        await share.getByRole("list", { name: "Links" }).getByRole("listitem").nth(1).waitFor();
        await scan(page, "share dialog with links");
        await share.getByRole("button", { name: "Revoke" }).first().click();
        await share.getByRole("button", { name: "Confirm revoke" }).waitFor();
        await scan(page, "share dialog, revoke confirmation");
        await share.getByRole("button", { name: "Cancel" }).click();
        const viewLink = await share.getByRole("textbox", { name: /can view/ }).inputValue();
        await share.getByRole("button", { name: "Close" }).click();

        const bobContext = await newPerson(browser);
        const bob = await bobContext.newPage();
        await bob.goto(editLink);
        await editorBody(bob).getByText("Three days").click();
        await bob.keyboard.type("Bob was here. ");
        await page.getByRole("list", { name: "People here" }).waitFor();
        await page.locator(".bn-collaboration-cursor__label").waitFor();
        await scan(page, "note with another person present");

        const viewerContext = await newPerson(browser);
        const viewer = await viewerContext.newPage();
        await viewer.goto(viewLink);
        await viewer.getByText("View only").waitFor();
        await editorBody(viewer).getByText("Plan").waitFor();
        await scan(viewer, "view only");
        await viewerContext.close();

        // The owner revokes Bob's link while he has the note open, then he opens it again.
        await page.getByRole("button", { name: "Share" }).click();
        const rows = share.getByRole("list", { name: "Links" }).getByRole("listitem");
        await rows.filter({ hasText: "Can edit" }).getByRole("button", { name: "Revoke" }).click();
        await share.getByRole("button", { name: "Confirm revoke" }).click();
        await expect(syncStatus(bob)).toHaveAttribute("data-sync-state", "stopped");
        await scan(bob, "sync stopped: link revoked");
        await bob.goto(editLink);
        await bob.getByRole("heading", { name: "This link is no longer valid" }).waitFor();
        await scan(bob, "invalid link");
        await bobContext.close();
      });

      test(`@M5a axe ${scheme} ${device}: offline, not found, link while offline`, async ({
        page,
        browser,
      }) => {
        const network = await controlSyncNetwork(page);
        network.block();
        await createNote(page, { title: "Written offline", text: "Not on the server yet." });
        await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "offline");
        await scan(page, "note offline");
        await page.goto("/");
        await page.getByText("Not backed up").first().waitFor();
        await scan(page, "list with a note not backed up");

        await page.goto("/n/AAAAAAAAAAAAAAAAAAAAA");
        await page.getByRole("heading", { name: "Note not found" }).waitFor();
        await scan(page, "note not found");

        network.unblock();
        const url = await createNote(page, { title: "Shared" });
        await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
        const link = await createShareLink(page, "view");
        expect(url).toContain("/n/");
        const bobContext = await newPerson(browser);
        const bob = await bobContext.newPage();
        await bob.route("**/api/**", (route) => route.abort("internetdisconnected"));
        await bob.goto(link);
        await bob.getByRole("heading", { name: "You’re offline" }).waitFor();
        await scan(bob, "opening a link while offline");
        await bobContext.close();
      });
    });
  }
}
