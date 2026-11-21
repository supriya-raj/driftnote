import type { Page } from "@playwright/test";
import { createNote, editorBody } from "./support/notes";
import { createShareLink } from "./support/share";
import { syncStatus } from "./support/sync";
import { expect, test } from "./support/users";

async function rename(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /^You:/ }).click();
  const dialog = page.getByRole("dialog", { name: "How others see you" });
  await dialog.getByRole("textbox", { name: "Your name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
}

test("@M2 a view link opens a read-only note that still shows live edits", async ({
  page: owner,
  bob: viewer,
}) => {
  await createNote(owner, { title: "Read me", text: "Version one." });
  const link = await createShareLink(owner, "view");
  await viewer.goto(link);

  await expect(viewer.getByTestId("note-editor")).toContainText("Version one.");
  await expect(viewer.getByText("View only")).toBeVisible();
  await expect(editorBody(viewer)).toHaveAttribute("contenteditable", "false");
  await expect(viewer.getByRole("textbox", { name: "Title" })).not.toBeEditable();
  await expect(viewer.getByRole("button", { name: "Share" })).toHaveCount(0);

  await editorBody(owner).click();
  await owner.keyboard.press("ControlOrMeta+End");
  await owner.keyboard.type(" Version two.");
  await expect(viewer.getByTestId("note-editor")).toContainText("Version two.");
  // Nothing to send: the viewer is fully synced and has nothing un-backed-up.
  await expect(syncStatus(viewer)).toHaveAttribute("data-sync-state", "synced");
});

test("@M2 a change forced into a viewer's copy never reaches the owner", async ({
  page: owner,
  bob: viewer,
}) => {
  await createNote(owner, { title: "Guarded", text: "Original." });
  const link = await createShareLink(owner, "view");
  await viewer.goto(link);
  await expect(viewer.getByTestId("note-editor")).toContainText("Original.");

  // Like a modified client: write straight into the viewer's Yjs document.
  await viewer.evaluate(() => window.__driftnote?.injectBlock("paragraph", "Sneaky edit"));
  // Barrier: the viewer's next message (a name change) is relayed after the injected
  // change would have been; once the owner sees the new name, the change had its chance.
  await rename(viewer, "Viewer Renamed");
  await expect(owner.getByRole("list", { name: "People here" })).toContainText("Viewer Renamed");

  await expect(owner.getByTestId("note-editor")).not.toContainText("Sneaky edit");
});
