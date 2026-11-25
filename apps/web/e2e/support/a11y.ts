import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.2 level A and AA rules (the M5a standard, docs/ACCESSIBILITY.md). */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Runs axe on the page as it is now and fails with a readable list of violations (rule,
 * impact, what is wrong, and the elements). Scan after the screen has settled: axe sees
 * only what is in the DOM at that moment.
 */
export async function expectAccessible(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const problems = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    elements: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
  expect(problems, `accessibility violations on "${screen}"`).toEqual([]);
}
