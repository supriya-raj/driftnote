import { createNote, editorBody, listedTitles } from "./support/notes";
import { createShareLink } from "./support/share";
import { syncStatus } from "./support/sync";
import { expect, test } from "./support/users";

test("@M2 an edit link lets a second person open the note, edit it, and keep it in their list", async ({
  page,
  bob,
}) => {
  await createNote(page, { title: "Team plan", text: "Agenda: " });
  const link = await createShareLink(page, "edit");

  await bob.goto(link);
  await expect(bob.getByRole("textbox", { name: "Title" })).toHaveValue("Team plan");
  await expect(bob.getByTestId("note-editor")).toContainText("Agenda:");
  await expect(syncStatus(bob)).toHaveAttribute("data-sync-state", "synced");

  await editorBody(bob).click();
  await bob.keyboard.press("ControlOrMeta+End");
  await bob.keyboard.type(" budget");
  await expect(page.getByTestId("note-editor")).toContainText("Agenda: budget");

  await bob.goto("/");
  await expect.poll(() => listedTitles(bob)).toEqual(["Team plan"]);
});

test("@M2 opening a link removes the token from the address bar", async ({ page, bob }) => {
  await createNote(page, { title: "Secret-ish" });
  const link = await createShareLink(page, "view");
  expect(link).toContain("#t=");

  await bob.goto(link);
  await expect(bob.getByRole("textbox", { name: "Title" })).toHaveValue("Secret-ish");
  expect(new URL(bob.url()).hash).toBe("");
});

test("@M2 a revoked link stops working: live and on the next visit", async ({ page, bob }) => {
  await createNote(page, { title: "Short-lived" });
  const link = await createShareLink(page, "edit");
  await bob.goto(link);
  await expect(syncStatus(bob)).toHaveAttribute("data-sync-state", "synced");

  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: /Share/ });
  await dialog.getByRole("button", { name: "Revoke" }).click();
  await dialog.getByRole("button", { name: "Confirm revoke" }).click();
  await expect(dialog.getByText("Revoked", { exact: true })).toBeVisible();

  await expect(bob.getByRole("alert").filter({ hasText: "link is no longer valid" })).toBeVisible();
  await expect(syncStatus(bob)).toHaveAttribute("data-sync-state", "stopped");

  await bob.goto(link); // opening the link again
  await expect(bob.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();
});

test("@M2 the share dialog lists links and can copy them again later", async ({ page }) => {
  await createNote(page, { title: "Listed" });
  const editLink = await createShareLink(page, "edit");
  await createShareLink(page, "view");

  await page.reload();
  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: /Share/ });
  const rows = dialog.getByRole("list", { name: "Links" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Can edit" }).getByRole("textbox")).toHaveValue(editLink);
});

test("@M2 only the owner can share: an editor sees no Share button", async ({ page, bob }) => {
  await createNote(page, { title: "Owner only" });
  const link = await createShareLink(page, "edit");
  await bob.goto(link);
  await expect(bob.getByRole("textbox", { name: "Title" })).toHaveValue("Owner only");
  await expect(bob.getByRole("button", { name: "Share" })).toHaveCount(0);
});
