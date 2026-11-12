import { expect, test } from "@playwright/test";

test("@M0 app loads and shows the Driftnote heading", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Driftnote");
  await expect(page.getByRole("heading", { level: 1, name: "Driftnote" })).toBeVisible();
});
