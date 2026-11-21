import { expect, test } from "@playwright/test";
import { createNote, editorBody } from "./support/notes";
import { syncStatus } from "./support/sync";

test("@M2 two tabs of one note stay in sync while the server is unreachable", async ({
  context,
  page: first,
}) => {
  const noteUrl = await createNote(first, { title: "Two tabs", text: "Start." });
  const second = await context.newPage(); // same browser profile = same person, two tabs
  await second.goto(noteUrl);
  await expect(second.getByTestId("note-editor")).toContainText("Start.");

  // Cut both tabs off from the sync server (every sync connection is closed at once).
  await context.routeWebSocket(/\/sync\//, (ws) => ws.close());
  await first.reload();
  await second.reload();
  await expect(syncStatus(first)).toHaveAttribute("data-sync-state", "offline");
  await expect(syncStatus(second)).toHaveAttribute("data-sync-state", "offline");

  await editorBody(first).click();
  await first.keyboard.press("ControlOrMeta+End");
  await first.keyboard.type(" Typed in the first tab.");
  await expect(second.getByTestId("note-editor")).toContainText("Typed in the first tab.");

  await editorBody(second).click();
  await second.keyboard.press("ControlOrMeta+End");
  await second.keyboard.type(" And in the second.");
  await expect(first.getByTestId("note-editor")).toContainText("And in the second.");
});
