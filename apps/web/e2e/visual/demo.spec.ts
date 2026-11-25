import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { editorBody, waitForLocalSave } from "../support/notes";
import { createShareLink } from "../support/share";
import { controlSyncNetwork, syncStatus } from "../support/sync";
import { waitForOfflineReady } from "../support/offline";
import { writeGif } from "./gif";
import { Recorder } from "./recorder";

/**
 * Not a test: records the README's demo GIFs and screenshots (`pnpm demo`, Chromium
 * only). Output goes to docs/media/. Excluded from normal runs by the @demo tag.
 */
const MEDIA = resolve(process.cwd(), "../../docs/media");
const PREVIEW = { dir: resolve(process.cwd(), "screenshots/demo"), count: 6 }; // git-ignored
const TYPE = { delay: 35 }; // human-ish typing speed

async function asPerson(context: BrowserContext, name: string, color: string): Promise<Page> {
  await context.addInitScript(
    ([n, c]) => {
      localStorage.setItem("driftnote.identity", JSON.stringify({ name: n, color: c }));
      // A demo browser that has granted persistent storage (no warning banner).
      StorageManager.prototype.persisted = () => Promise.resolve(true);
    },
    [name, color] as const,
  );
  return context.newPage();
}

async function newNote(page: Page, title: string, lines: string[]): Promise<void> {
  await openNewNote(page);
  await page.getByRole("textbox", { name: "Title" }).pressSequentially(title, TYPE);
  await editorBody(page).click();
  for (const [i, line] of lines.entries()) {
    if (i > 0) await page.keyboard.press("Enter");
    await page.keyboard.type(line, TYPE);
  }
  await waitForLocalSave(page);
}

/** Clicks "New note" and waits until the new, empty note is on screen. */
async function openNewNote(page: Page): Promise<void> {
  const before = page.url();
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page).not.toHaveURL(before);
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("");
}

/** Puts the caret at the end of the block whose text is exactly `text`. */
async function caretAtEndOf(page: Page, text: string): Promise<void> {
  // Click the start of the line (clicking a word's middle proved unreliable here), then End.
  await editorBody(page)
    .locator(".bn-inline-content", { hasText: text })
    .first()
    .click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("End");
}

async function quickNote(page: Page, title: string, text: string): Promise<void> {
  await openNewNote(page);
  await page.getByRole("textbox", { name: "Title" }).fill(title);
  await editorBody(page).click();
  await page.keyboard.insertText(text);
  await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms); // demo pacing only

test.describe("demo", () => {
  test.setTimeout(180_000);

  test("@demo works offline", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 640 },
      colorScheme: "light",
      serviceWorkers: "allow",
    });
    const page = await asPerson(context, "Alice Chen", "#0f6e7a");
    const network = await controlSyncNetwork(context);
    await page.goto("/");
    await quickNote(page, "Reading list", "Piranesi, The Overstory");
    await quickNote(page, "Groceries", "Lemons, oat milk, rice");
    await waitForOfflineReady(page);
    await page.goto("/");

    const recorder = new Recorder(page, 880);
    await recorder.start();
    await pause(page, 600);
    await newNote(page, "Weekend in Porto", ["Book the train on Friday", "Walk along the river"]);
    await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced");
    await pause(page, 900);

    // The network goes away.
    await context.setOffline(true);
    network.block();
    await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "offline");
    await pause(page, 600);
    await page.keyboard.press("Enter");
    await page.keyboard.type("Pastel de nata tasting (added offline)", TYPE);
    await waitForLocalSave(page);
    await pause(page, 900);

    // Reload with no network: the app and the note come from this browser.
    await page.reload();
    await expect(page.getByTestId("note-editor")).toContainText("added offline");
    await pause(page, 1500);

    // Back online: it syncs by itself.
    await context.setOffline(false);
    network.unblock();
    await expect(syncStatus(page)).toHaveAttribute("data-sync-state", "synced", {
      timeout: 15_000,
    });
    await pause(page, 1200);

    const result = writeGif(resolve(MEDIA, "offline.gif"), [await recorder.stop()], {
      fps: 10,
      holdEndMs: 2500,
      preview: PREVIEW,
    });
    console.log(
      `offline.gif: ${String(result.frames)} frames, ${String(Math.round(result.bytes / 1024))} KB`,
    );
    await context.close();
  });

  test("@demo real-time collaboration", async ({ browser }) => {
    // Each window at least 768px wide, so it shows the desktop (two-pane) layout.
    const options = { viewport: { width: 820, height: 600 }, colorScheme: "light" as const };
    const aliceContext = await browser.newContext(options);
    const bobContext = await browser.newContext(options);
    const alice = await asPerson(aliceContext, "Alice Chen", "#0f6e7a");
    const bob = await asPerson(bobContext, "Bob Rivera", "#c2298a");
    await alice.goto("/");
    await bob.goto("/");
    await quickNote(alice, "Reading list", "Piranesi, The Overstory");

    const recorders = [new Recorder(alice, 600), new Recorder(bob, 600)];
    for (const r of recorders) await r.start();
    await pause(alice, 600);

    await newNote(alice, "Team offsite", ["Agenda", "Budget"]);
    await expect(syncStatus(alice)).toHaveAttribute("data-sync-state", "synced");
    const link = await createShareLink(alice, "edit");
    await bob.goto(link);
    await expect(bob.getByTestId("note-editor")).toContainText("Budget");
    await pause(alice, 800);

    // Both type at the same time, on different lines.
    // One at a time, as people would: a cursor move by one person can undo a key press
    // the other made at that exact instant (suspected editor race, see LEARNING_LOG).
    await caretAtEndOf(bob, "Budget");
    await pause(bob, 400);
    await caretAtEndOf(alice, "Agenda");
    await pause(alice, 400);
    await Promise.all([
      alice.keyboard.type(": kickoff, then a walk by the lake", TYPE),
      bob.keyboard.type(": under 2,000 for the whole team", TYPE),
    ]);
    // The recording must show the right result, or it is not published.
    for (const page of [alice, bob]) {
      const blocks = editorBody(page).locator(".bn-inline-content");
      await expect(blocks.nth(0)).toHaveText(/^Agenda: kickoff, then a walk by the lake/);
      await expect(blocks.nth(1)).toHaveText(/^Budget: under 2,000 for the whole team/);
    }
    await pause(alice, 1800);

    const tracks = await Promise.all(recorders.map((r) => r.stop()));
    const result = writeGif(resolve(MEDIA, "collaboration.gif"), tracks, {
      fps: 10,
      holdEndMs: 2500,
      preview: PREVIEW,
    });
    console.log(
      `collaboration.gif: ${String(result.frames)} frames, ${String(Math.round(result.bytes / 1024))} KB`,
    );

    // Still images for the top of the README: Alice's window, light and dark.
    // A cursor's name label shows while hovering it (it also shows briefly while that
    // person types), so each still is taken while hovering Bob's cursor.
    const showBobsLabel = async (): Promise<void> => {
      await alice.locator(".bn-collaboration-cursor__caret").first().hover({ force: true });
      await alice
        .locator(".bn-collaboration-cursor__base[data-active]")
        .waitFor({ state: "attached" });
      await pause(alice, 400); // the label animates in over 0.2 s
    };
    await alice.setViewportSize({ width: 1280, height: 760 });
    await bob.keyboard.type(", travel included", TYPE);
    await expect(syncStatus(alice)).toHaveAttribute("data-sync-state", "synced");
    await showBobsLabel();
    await alice.screenshot({ path: resolve(MEDIA, "app-light.png") });
    await alice.emulateMedia({ colorScheme: "dark" });
    await showBobsLabel();
    await alice.screenshot({ path: resolve(MEDIA, "app-dark.png") });
    await aliceContext.close();
    await bobContext.close();
  });
});
