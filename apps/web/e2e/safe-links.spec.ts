import { expect, test, type Page } from "@playwright/test";
import { createNote } from "./support/notes";

// Links can arrive inside a document update (a collaborator, a tampered message), which
// skips the editor's paste and typing filters. The hook injects one the same way.
async function inject(page: Page, text: string, href: string): Promise<void> {
  await page.evaluate(([t, h]) => window.__driftnote?.injectLink(t, h), [text, href] as const);
}

const link = (page: Page, text: string) =>
  page.getByTestId("note-editor").locator("a", { hasText: new RegExp(`^${text}$`) });

test("@M1 only http, https and mailto links keep their address", async ({ page }) => {
  await createNote(page, { text: "Links below" });
  await inject(page, "web", "https://example.com/docs");
  await inject(page, "plain web", "http://example.com/");
  await inject(page, "email", "mailto:a@example.com");
  await inject(page, "script", "javascript:window.__pwned=true");
  await inject(page, "file transfer", "ftp://example.com/file"); // allowed by BlockNote's default

  await expect(link(page, "web")).toHaveAttribute("href", "https://example.com/docs");
  await expect(link(page, "plain web")).toHaveAttribute("href", "http://example.com/");
  await expect(link(page, "email")).toHaveAttribute("href", "mailto:a@example.com");
  await expect(link(page, "script")).toHaveAttribute("href", "");
  await expect(link(page, "file transfer")).toHaveAttribute("href", "");
  await expect(page.locator('a[href^="javascript:" i]')).toHaveCount(0);
});

test("@M1 clicking an unsafe link does nothing", async ({ page, context }) => {
  await createNote(page, { text: "Links below" });
  await inject(page, "script", "javascript:window.__pwned=true");
  let popups = 0;
  context.on("page", () => (popups += 1));

  await link(page, "script").click();
  await link(page, "script").click({ modifiers: ["ControlOrMeta"] });

  // Unsafe links are styled as plain text, so nothing invites a click.
  await expect(link(page, "script")).toHaveCSS("text-decoration-line", "none");
  expect(await page.evaluate(() => "__pwned" in window)).toBe(false);
  expect(popups).toBe(0);
});

test("@M1 links can be injected into an empty note", async ({ page }) => {
  await createNote(page);
  await inject(page, "email me", "mailto:a@example.com");
  await expect(link(page, "email me")).toHaveAttribute("href", "mailto:a@example.com");
});
