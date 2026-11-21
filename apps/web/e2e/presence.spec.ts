import type { Page } from "@playwright/test";
import { createNote, editorBody } from "./support/notes";
import { createShareLink } from "./support/share";
import { expect, test } from "./support/users";

async function setMyName(page: Page, name: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /^You:/ }).click();
  const dialog = page.getByRole("dialog", { name: "How others see you" });
  await dialog.getByRole("textbox", { name: "Your name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: `You: ${name}` })).toBeVisible();
}

test("@M2 two people see each other's names: in the toolbar and on their cursors", async ({
  page: alice,
  bob,
}) => {
  await setMyName(alice, "Alice");
  await setMyName(bob, "Bob");

  await createNote(alice, { title: "Pairing", text: "Hello" });
  const link = await createShareLink(alice, "edit");
  await bob.goto(link);
  await expect(bob.getByTestId("note-editor")).toContainText("Hello");

  await expect(alice.getByRole("list", { name: "People here" })).toContainText("Bob");
  await expect(bob.getByRole("list", { name: "People here" })).toContainText("Alice");

  await editorBody(bob).click();
  await bob.keyboard.press("ControlOrMeta+End");
  await bob.keyboard.type(" from Bob");
  await expect(alice.locator(".bn-collaboration-cursor__label", { hasText: "Bob" })).toHaveCount(1);
});

test("@M2 a name is kept across reloads and new people get a default name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^You: \S/ })).toBeVisible(); // a default
  await setMyName(page, "Remembered");
  await page.reload();
  await expect(page.getByRole("button", { name: "You: Remembered" })).toBeVisible();
});
