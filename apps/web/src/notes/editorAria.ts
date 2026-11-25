/**
 * Repairs to the ARIA that BlockNote 0.57 renders (docs/ACCESSIBILITY.md), applied to its
 * DOM as it changes:
 *
 * - The slash menu (`role="listbox"`) gets a name, so a screen reader can say what the list
 *   is for.
 * - `aria-expanded` is removed from the editor while the menu is open. BlockNote sets it on
 *   an element with `role="textbox"`, where ARIA does not allow it (screen readers ignore
 *   it). The menu stays linked to the editor through `aria-haspopup`, `aria-controls` and
 *   `aria-activedescendant`, which are allowed and are what announces the chosen item.
 *
 * Returns a function that stops watching.
 */
export function repairEditorAria(root: HTMLElement): () => void {
  const repair = (): void => {
    for (const editor of root.querySelectorAll('[role="textbox"][aria-expanded]')) {
      editor.removeAttribute("aria-expanded");
    }
    for (const menu of root.querySelectorAll('[role="listbox"]:not([aria-label])')) {
      menu.setAttribute("aria-label", SLASH_MENU_LABEL);
    }
  };
  repair();
  const observer = new MutationObserver(repair);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "role"],
  });
  return () => observer.disconnect();
}

export const SLASH_MENU_LABEL = "Insert a block";
