import { expect, type Page } from "@playwright/test";

/** Opens the share dialog, creates a link with `role`, closes the dialog; returns the link. */
export async function createShareLink(page: Page, role: "edit" | "view"): Promise<string> {
  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: /Share/ });
  await dialog.getByRole("button", { name: `Create ${role} link` }).click();
  const field = dialog.getByRole("textbox", { name: role === "edit" ? "Edit link" : "View link" });
  await expect(field).toHaveValue(/#t=/);
  const link = await field.inputValue();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  return link;
}
