import { test, type Page } from "@playwright/test";
import { createNote, editorBody, waitForLocalSave } from "../support/notes";
import { controlSyncNetwork, syncStatus } from "../support/sync";

/**
 * Not a test: captures every screen for visual review (`pnpm shots`, docs/DESIGN.md).
 * Images go to `screenshots/` (git-ignored). Excluded from normal runs by the @shots tag.
 */
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
} as const;

async function seedNotes(page: Page): Promise<string> {
  await createNote(page, { title: "Reading list", text: "Books for the winter" });
  await createNote(page, { title: "Groceries", text: "Oat milk, lemons, rice" });
  await createNote(page, { text: "A thought without a title" });
  const url = await createNote(page, { title: "Trip to Lisbon" });
  await editorBody(page).click();
  await page.keyboard.type("# Plan\n");
  await page.keyboard.type(
    "Three days in late spring. Book the tram tour early and leave one afternoon free.\n",
  );
  await page.keyboard.type("- Pastéis de Belém\nMiradouro da Graça\nLX Factory\n\n");
  await page.keyboard.type("Packing notes are in the shared doc.");
  await page.evaluate(() =>
    window.__driftnote?.injectLink("Lisbon travel guide", "https://www.visitlisboa.com/"),
  );
  await waitForLocalSave(page);
  return url;
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `screenshots/${name}.png`, animations: "disabled" });

for (const scheme of ["light", "dark"] as const) {
  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`${scheme} ${device}`, () => {
      test.use({ colorScheme: scheme, viewport });
      const prefix = `${device}-${scheme}`;

      test(`@shots screens ${prefix}`, async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "New note" }).waitFor();
        await shot(page, `${prefix}-01-home-empty`);

        const noteUrl = await seedNotes(page);
        await page.goto("/");
        await page.getByRole("list", { name: "Notes" }).waitFor();
        await shot(page, `${prefix}-02-home`);

        await page.goto(noteUrl);
        await editorBody(page).waitFor();
        await syncStatus(page).and(page.locator('[data-sync-state="synced"]')).waitFor();
        await page.mouse.move(0, 0);
        await shot(page, `${prefix}-03-note`);

        await editorBody(page).click();
        await page.keyboard.press("ControlOrMeta+End");
        await page.keyboard.press("Enter");
        await page.keyboard.type("/");
        await page.getByRole("listbox").waitFor();
        await shot(page, `${prefix}-04-slash-menu`);
        await page.keyboard.press("Escape");

        await page.getByRole("button", { name: "Delete note" }).click();
        await shot(page, `${prefix}-05-delete-confirm`);
        await page.getByRole("button", { name: "Cancel" }).click();

        await page.evaluate(() => window.__driftnote?.setSchemaVersion(99));
        await shot(page, `${prefix}-06-read-only`);

        const network = await controlSyncNetwork(page);
        network.block();
        await createNote(page, { title: "Written offline", text: "Not on the server yet." });
        await syncStatus(page).and(page.locator('[data-sync-state="offline"]')).waitFor();
        await shot(page, `${prefix}-08-offline`);
        network.unblock();

        await page.goto("/n/AAAAAAAAAAAAAAAAAAAAA");
        await page.getByRole("heading", { name: "Note not found" }).waitFor();
        await shot(page, `${prefix}-07-not-found`);
      });
    });
  }
}
