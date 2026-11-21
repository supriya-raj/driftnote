import { expect, test, type Page } from "@playwright/test";
import { createNote, editorBody } from "./support/notes";
import { createShareLink } from "./support/share";

async function typeOnNewLine(page: Page, text: string): Promise<void> {
  await editorBody(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(text);
}

// M2 "done when": two people editing one note see both edits in both views.
// Written as expected-to-fail in T21; switched to a normal test in T34, which made it pass.
test("@M2-done two people editing one note both see both edits", async ({ browser }) => {
  // Separate browser contexts = separate people (no shared storage or cookies).
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();

  await createNote(alice, { title: "Shared plan", text: "Alice wrote this first." });
  const link = await createShareLink(alice, "edit"); // Share → Create edit link → close

  await bob.goto(link);
  await expect(bob.getByTestId("note-editor")).toContainText("Alice wrote this first.");

  await typeOnNewLine(bob, "Bob added this.");
  await typeOnNewLine(alice, "Alice replied.");

  for (const page of [alice, bob]) {
    const editor = page.getByTestId("note-editor");
    await expect(editor).toContainText("Bob added this.");
    await expect(editor).toContainText("Alice replied.");
  }
});
