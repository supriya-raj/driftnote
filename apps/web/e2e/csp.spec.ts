import { createNote, editorBody } from "./support/notes";
import { createShareLink } from "./support/share";
import { expect, test } from "./support/users";

// Records every Content Security Policy violation the browser reports.
test.beforeEach(async ({ page, bob }) => {
  for (const p of [page, bob]) {
    await p.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
  }
});

const violations = (p: import("@playwright/test").Page) =>
  p.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

test("@M2 the app's main flows run under the security policy without violations", async ({
  page,
  bob,
}) => {
  await createNote(page, { title: "Policy check", text: "Some text" });
  await editorBody(page).click();
  await page.keyboard.type(" /");
  await expect(page.getByRole("listbox")).toBeVisible(); // slash menu (Mantine UI)
  await page.keyboard.press("Escape");
  const link = await createShareLink(page, "edit");
  await bob.goto(link);
  await expect(bob.getByTestId("note-editor")).toContainText("Some text");
  await editorBody(bob).click();
  await bob.keyboard.type("!");
  await expect(page.locator(".bn-collaboration-cursor__label")).toHaveCount(1); // cursors
  await page.getByRole("button", { name: /^You:/ }).click(); // profile dialog
  await page.keyboard.press("Escape");

  expect(await violations(page)).toEqual([]);
  expect(await violations(bob)).toEqual([]);
});

test("@M2 an injected inline script is blocked by the policy", async ({ page }) => {
  await page.goto("/");
  const ran = await page.evaluate(() => {
    const w = window as unknown as { __inlineRan?: boolean };
    const script = document.createElement("script");
    script.textContent = "window.__inlineRan = true";
    document.body.append(script);
    return w.__inlineRan === true;
  });
  expect(ran).toBe(false);
  expect(await violations(page)).toEqual(
    expect.arrayContaining([expect.stringContaining("script-src")]),
  );
});
