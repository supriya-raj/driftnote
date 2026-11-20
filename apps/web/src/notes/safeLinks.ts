/**
 * Link policy (ADR 011): only these schemes are rendered as working links. Anything else
 * (`javascript:`, `data:`, `ftp:`, `file:`, ...) is shown as plain text. BlockNote's own
 * default is wider, so the editor is configured with this check.
 */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

export function isSafeLinkHref(href: string): boolean {
  // Browsers ignore leading/trailing whitespace and control characters in URLs, which is
  // a classic way to sneak `javascript:` past naive prefix checks. `URL` normalises them.
  try {
    return SAFE_SCHEMES.has(new URL(href).protocol);
  } catch {
    return false; // relative or malformed: not a link we can vouch for
  }
}

/**
 * Click handler for editor links: opens only safe links, in a new tab without giving the
 * opened page a handle on this one. Unsafe links render with an empty `href`; clicking
 * them does nothing.
 */
export function openLinkSafely(event: MouseEvent): boolean {
  const anchor =
    event.target instanceof Element
      ? event.target.closest('a[data-inline-content-type="link"]')
      : null;
  const href = anchor?.getAttribute("href") ?? "";
  if (isSafeLinkHref(href)) window.open(href, "_blank", "noopener,noreferrer");
  return true; // handled: never fall through to default navigation
}
