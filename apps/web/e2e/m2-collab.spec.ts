import type { Page } from "@playwright/test";
import { LINE_END_KEY } from "./support/keyboard";
import { createNote, editorBody } from "./support/notes";
import { createShareLink } from "./support/share";
import { expect, test } from "./support/users";

async function typeOnNewLine(page: Page, text: string): Promise<void> {
  await editorBody(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(text);
}

// M2 "done when": two people editing one note see both edits in both views.
// Written as expected-to-fail in T21; switched to a normal test in T34, which made it pass.
test("@M2-done two people editing one note both see both edits", async ({ page: alice, bob }) => {
  // Separate browser contexts = separate people (no shared storage or cookies).
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

/** Puts the caret at the end of the block whose text is exactly `text`. */
/**
 * Puts the caret at the end of the line `text`. A caret move made with keys alone can be
 * undone by another person's change landing in the same instant (open question in
 * docs/PROGRESS.md), which is not what this test is about, so the move is confirmed and
 * retried if it did not register.
 */
async function caretAtEndOf(page: Page, text: string): Promise<void> {
  await expect(async () => {
    await editorBody(page).getByText(text, { exact: true }).click();
    await page.keyboard.press(LINE_END_KEY);
    const atEnd = await page.evaluate((line) => {
      const selection = getSelection();
      return selection?.anchorNode?.textContent === line && selection.anchorOffset === line.length;
    }, text);
    expect(atEnd).toBe(true);
  }).toPass({ timeout: 5000 });
}

test("@M2 two people typing at the same moment on different lines each keep their place", async ({
  page: alice,
  bob,
}) => {
  await createNote(alice, { title: "Side by side", text: "Agenda" });
  await alice.keyboard.press("Enter");
  await alice.keyboard.type("Budget");
  const link = await createShareLink(alice, "edit");
  await bob.goto(link);
  await expect(bob.getByTestId("note-editor")).toContainText("Budget");

  await caretAtEndOf(alice, "Agenda");
  await caretAtEndOf(bob, "Budget");
  await Promise.all([
    alice.keyboard.type(" first item, second item", { delay: 30 }),
    bob.keyboard.type(" under 2,000", { delay: 30 }),
  ]);

  for (const page of [alice, bob]) {
    const blocks = editorBody(page).locator(".bn-inline-content");
    await expect(blocks.nth(0)).toHaveText(/^Agenda first item, second item/);
    await expect(blocks.nth(1)).toHaveText(/^Budget under 2,000/);
  }
});
