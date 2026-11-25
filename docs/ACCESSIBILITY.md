# Driftnote: accessibility

What Driftnote promises, how it is checked, and what is known not to be perfect.
Milestone M5a (`docs/EXECUTION_PLAN.md`, Phase 5a).

## Standard

**WCAG 2.2, level AA.** In practice:

- every screen works with the keyboard alone, with a visible focus ring, and focus is never
  lost or hidden behind other content;
- text has a contrast of at least 4.5:1 (3:1 for large text) in light and dark mode, on
  every surface it can sit on;
- click and touch targets are at least 24 by 24 px;
- everything has a name a screen reader can announce, and changes that happen without
  focus moving (sync state, a copied link) are announced.

## How it is checked

| Check | Where | What it covers |
|---|---|---|
| axe scans (automated) | `apps/web/e2e/a11y-scans.spec.ts` | Every screen and state in light and dark, at desktop and phone width, against the WCAG 2.2 A/AA rules (`e2e/support/a11y.ts`) |
| Keyboard-only flow | `apps/web/e2e/m5a-accessibility.spec.ts` | Create, title, write, share, open from the list, rename, delete, without a mouse |
| Every later UI task | `expectAccessible(page, …)` in its tests | New screens meet the same bar (rule in the execution plan) |

axe finds roughly a third to a half of real problems: it can measure contrast and check
names, but it cannot tell whether an announcement makes sense or a focus order is
logical. The keyboard tests and the manual audit cover the rest.

## Keyboard

| Where | Keys |
|---|---|
| Anywhere | Tab / Shift+Tab between controls; the first Tab offers "Skip to main content" |
| Safari | Option+Tab (or Settings → Advanced → "Press Tab to highlight each item"): by default Safari's Tab only visits text fields. The tests press Option+Tab in WebKit for this reason |
| New note | Focus starts in the title; Enter moves to the text |
| Note text | Typing, `/` for the block menu (arrow keys, Enter, Escape), Tab / Shift+Tab indent and outdent, **Escape leaves the text** (to the title) |
| Dialogs (share, profile) | Focus starts inside and stays there; Escape closes and returns focus to the button that opened it |
| Delete and revoke confirmations | Focus starts on the safe choice (Cancel); Escape or Cancel returns focus to the button |
| macOS caret keys | Cmd+Left/Right for line start and end (Firefox and Safari use Home/End to scroll the page) |

Tested in `apps/web/e2e/keyboard.spec.ts`, one test per behaviour, in Chromium, Firefox
and WebKit.

## Repairs to third-party components

BlockNote (the editor, 0.57) and Mantine (its menus) render their own HTML. Where it falls
short we fix it from our side, and the scans check the fix:

| Problem | Fix | Where |
|---|---|---|
| The editable area has no name | `aria-label="Note text"` through BlockNote's `domAttributes` | `pages/NoteEditor.tsx` |
| While the slash menu is open, BlockNote sets `aria-expanded` on an element with `role="textbox"`, where ARIA does not allow it | Removed as it appears; the menu stays linked through `aria-haspopup`, `aria-controls` and `aria-activedescendant` (allowed, and what announces the chosen item) | `notes/editorAria.ts` |
| The slash menu (`role="listbox"`) has no name | `aria-label="Insert a block"` | `notes/editorAria.ts` |
| A link alone on its line is 20px tall | 3px vertical padding (does not move text) | `pages/NoteEditor.css` |
| With no menu open, BlockNote's Escape blurs the editor, leaving focus on `<body>` | Focus then goes to the title | `pages/NoteEditor.tsx` |
| Tab indents inside the text, so Tab alone never leaves it (WCAG 2.1.2) | Escape is the way out; the editor's `aria-describedby` says so | `pages/NoteEditor.tsx` |

## Known exceptions

Each exception is one axe rule on one element, listed in `e2e/support/a11y.ts` with its
reason, and backed by a test that checks the real behaviour. Anything else on that
element, and the same rule anywhere else, still fails.

| Rule | Element | Why it does not apply | Backed by |
|---|---|---|---|
| `scrollable-region-focusable` | `#bn-suggestion-menu` (slash menu) | The menu is driven from the editor with `aria-activedescendant`: arrow keys move through every item and scroll it into view, so it is keyboard-reachable without focusable content. axe cannot see that. | "the slash menu is keyboard-reachable to its last item" in `a11y-scans.spec.ts` |

## Known limitations

- **Cursor labels use the other person's colour with white text.** The app only offers
  colours with at least 4.5:1 against white (older palette colours are replaced on load),
  but a modified client could announce a pale colour for its own cursor. Avatars already
  pick white or dark initials by contrast (`lib/contrast.ts`); cursor labels are drawn by
  BlockNote.
- **A caret move made with keys alone can be undone by a collaborator's change landing in
  the same instant** (seen as a lost End / Cmd+Right in tests with two people, about 1 run
  in 3 in Chromium under load). Likely cause: the browser moves the caret natively and the
  editor (ProseMirror) only learns of it on the next `selectionchange`; a remote change
  applied in between redraws the caret from the editor's older position. Typing is not
  affected (each keystroke is a transaction). Upstream (ProseMirror / y-prosemirror); open
  question in `docs/PROGRESS.md`.
