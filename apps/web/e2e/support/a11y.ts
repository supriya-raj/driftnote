import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.2 level A and AA rules (the M5a standard, docs/ACCESSIBILITY.md). */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Findings that are checked by other means and documented in docs/ACCESSIBILITY.md
 * ("Known exceptions"). Each is one rule on one element, with the reason; anything else
 * on that element, and the same rule anywhere else, still fails.
 */
const KNOWN_EXCEPTIONS: { rule: string; target: string; reason: string }[] = [
  {
    rule: "scrollable-region-focusable",
    target: "#bn-suggestion-menu",
    reason:
      "BlockNote's slash menu is a listbox driven from the editor with aria-activedescendant: " +
      "arrow keys move through it and scroll it, so it is keyboard-reachable without " +
      "focusable content (axe cannot see that). Proven by the keyboard test of the menu.",
  },
];

/**
 * Runs axe on the page as it is now and fails with a readable list of violations (rule,
 * impact, what is wrong, and the elements). Waits for running animations first: halfway
 * through a fade-in, text is measured at a fraction of its colour. `soft` records the
 * failure and carries on, so one test can report every screen it visits.
 */
export async function expectAccessible(
  page: Page,
  screen: string,
  options: { soft?: boolean } = {},
): Promise<void> {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const problems = results.violations
    .map((v) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      elements: v.nodes
        .map((n) => n.target.join(" "))
        .filter((target) => !KNOWN_EXCEPTIONS.some((e) => e.rule === v.id && e.target === target)),
    }))
    .filter((p) => p.elements.length > 0)
    .map((p) => ({ ...p, elements: p.elements.slice(0, 5) }));
  const check = options.soft ? expect.soft : expect;
  check(problems, `accessibility violations on "${screen}"`).toEqual([]);
}

/** Waits for every finite animation and transition (infinite ones, like a spinner, never end). */
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}
