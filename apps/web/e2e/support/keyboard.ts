import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Moves focus with the Tab key only (never a click) until `target` has focus, the way a
 * keyboard user would. Fails if it is not reached within `max` presses, listing what got
 * focus on the way, which shows where the tab order went wrong.
 */
/**
 * The key that moves the caret to the end of the line. On macOS that is Cmd+Right: there,
 * Firefox and Safari use End to scroll to the bottom of the page (Chromium accepts both).
 */
export const LINE_END_KEY = process.platform === "darwin" ? "Meta+ArrowRight" : "End";

/**
 * The key that moves focus to the next control. Safari (WebKit) by default moves Tab only
 * between form fields; its users press Option+Tab (or change a setting) to reach buttons
 * and links too, so in WebKit the tests press that.
 */
export function tabKey(page: Page, options: { backwards?: boolean } = {}): string {
  const webkit = page.context().browser()?.browserType().name() === "webkit";
  return `${options.backwards ? "Shift+" : ""}${webkit ? "Alt+" : ""}Tab`;
}

/** Presses Tab (Option+Tab in WebKit, see `tabKey`). */
export function pressTab(page: Page, options: { backwards?: boolean } = {}): Promise<void> {
  return page.keyboard.press(tabKey(page, options));
}

export async function tabTo(
  page: Page,
  target: Locator,
  options: { max?: number; backwards?: boolean } = {},
): Promise<void> {
  const max = options.max ?? 40;
  const key = tabKey(page, options);
  const visited: string[] = [];
  for (let i = 0; i < max; i++) {
    if (await isFocused(target)) return;
    await page.keyboard.press(key);
    visited.push(await describeFocus(page));
  }
  if (await isFocused(target)) return;
  throw new Error(
    `Tab never reached ${target.toString()} in ${String(max)} presses. Focus went:\n  ${visited.join("\n  ")}`,
  );
}

/** Asserts that focus is on a real element (not lost to <body>) and its ring is shown. */
export async function expectFocusVisible(page: Page, where: string): Promise<void> {
  const state = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      lost: !el || el === document.body || el === document.documentElement,
      visible: el?.matches(":focus-visible") ?? false,
    };
  });
  expect(state.lost, `focus was lost (on <body>) ${where}`).toBe(false);
  expect(state.visible, `focus ring not shown ${where}: ${await describeFocus(page)}`).toBe(true);
}

async function isFocused(target: Locator): Promise<boolean> {
  // Not there (yet) means not focused: answer at once instead of waiting for it to appear.
  if ((await target.count()) === 0) return false;
  return target.evaluate((el) => el === document.activeElement).catch(() => false);
}

/** A short description of the focused element, for error messages. */
export function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "<body> (focus lost)";
    const text = el.textContent.trim().slice(0, 40);
    const name = el.getAttribute("aria-label") ?? (text || el.getAttribute("placeholder"));
    return `<${el.tagName.toLowerCase()}> "${name}"`;
  });
}
