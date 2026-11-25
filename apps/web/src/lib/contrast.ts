/**
 * WCAG contrast helpers, for colours chosen at run time (other people's presence colours
 * arrive over the network and can be anything).
 */

/** Relative luminance of a `#rrggbb` colour (WCAG 2 definition), or null if not one. */
function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1], 16);
  const channel = (shift: number): number => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/** Contrast ratio between two `#rrggbb` colours (1 to 21), or null if either is not one. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#1f1d1a";

/** White or near-black, whichever reads better on `background`. */
export function readableTextOn(background: string): string {
  const onLight = contrastRatio(LIGHT_TEXT, background);
  const onDark = contrastRatio(DARK_TEXT, background);
  if (onLight === null || onDark === null) return LIGHT_TEXT;
  return onLight >= 4.5 || onLight >= onDark ? LIGHT_TEXT : DARK_TEXT;
}
