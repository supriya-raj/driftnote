# Driftnote: design system

The look and feel every screen follows. The owner's standard: **professional and
beautiful**, in every task, not as a final polish pass.

## Principles
- **Calm, paper-like, content first.** Warm neutral greys, generous whitespace, one accent
  colour. The note is the hero; chrome stays quiet.
- **One accent, used sparingly:** sea teal (`--accent`) marks the primary action and the
  current selection. Red only for destructive actions.
- **Clear hierarchy:** note title (40px) > heading 1 (28px) > heading 2 (22px) >
  heading 3 (19px) > body (16px in the editor, 14px in the interface).
- **Light and dark** from the operating system setting, with equal care for both.
- **Works at phone width:** below 768px, one pane at a time.
- **Accessible by default:** WCAG 2.2 AA (`docs/ACCESSIBILITY.md`): visible focus rings,
  text contrast of at least 4.5:1 on every surface (hover states included), click targets
  of at least 24px, real buttons and links, `prefers-reduced-motion` respected.

## Implementation
- **Plain CSS with design tokens:** no CSS framework or component library for the app's
  own UI. BlockNote keeps its Mantine-based menus, re-coloured through its CSS variables.
- `apps/web/src/styles/tokens.css`: every colour, radius, shadow, spacing and type size,
  with dark-mode overrides. **Never hard-code a colour or size in a component**; add a
  token if one is missing.
- `apps/web/src/styles/base.css`: element defaults and shared classes.
- Component styles live next to the component (`Sidebar.tsx` + `Sidebar.css`).
- Icons: `components/Icon.tsx` (inline SVG, 16px grid, 1.75px stroke). Add new icons
  there in the same style. Logo: `components/Logo.tsx` and `public/favicon.svg`.
- Font: Inter (bundled by BlockNote), with system-font fallback.

## Tokens (summary)

| Group | Tokens |
|---|---|
| Surfaces | `--bg`, `--surface`, `--surface-sunken` (sidebar), `--surface-hover`, `--surface-active` |
| Lines | `--border`, `--border-strong` |
| Text | `--text`, `--text-muted`, `--text-faint` (all at least 4.5:1 on every surface; faint is for secondary details, not for anything a user must read to act) |
| Accent | `--accent`, `--accent-hover`, `--accent-soft`, `--accent-text`, `--on-accent` |
| Status | `--danger*` (text on a danger fill: `--on-danger`), `--warning-*`, `--info-*`, `--success` |
| Shape | `--radius-sm/md/lg` (6/8/12px), `--shadow-sm/md/lg`, `--focus-ring` |
| Spacing | `--space-1`…`--space-7` (4, 8, 12, 16, 24, 32, 48px) |
| Type | `--text-xs/sm/md/lg/title` (12, 13, 14, 16, 40px) |
| Layout | `--sidebar-width` (288px), `--content-width` (760px), `--toolbar-height` (52px) |

## Components

| Component | Classes / file | Use |
|---|---|---|
| Buttons | `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger` / `.btn-ghost-danger` | One primary per view. Icon + text label; 32px tall. |
| Notices | `.notice` + `.notice-warning` / `.notice-info` | Inline, with an icon, a bold title and one short sentence. |
| Popover | `.popover` (`DeleteNoteButton.css`) | Small confirmations; focus moves to the safe choice; Escape and outside click close it. |
| Toast | `.toast` (`UpdatePrompt.css`) | Non-blocking app messages: bottom right on desktop; on phones a bar under the page, so it never covers controls. |
| Empty states | `EmptyState`, `.note-missing` | Soft icon tile, short heading, one sentence, optional action. |
| Note list | `Sidebar.tsx` | Title + relative time; whole row clickable (stretched link); active row raised. |

## Focus and keyboard
- **Every control shows a focus ring** (`--focus-ring`) when reached by keyboard. A
  component that sets its own `box-shadow` must keep the ring winning (see `.btn:focus-visible`
  in `base.css`). Exceptions: the note title and text, which show focus with the caret.
- **Focus is never lost.** When an action removes the focused element, focus moves to the
  next sensible place: a new note → its title; opening a note → the note (`<article>`,
  not the title field, so phones do not pop up the keyboard); back to the list or after a
  delete → "New note"; a confirmation → its safe choice; cancelling it → the button that
  opened it.
- **Dialogs** are native `<dialog>` + `showModal()` (focus stays inside, Escape closes,
  focus returns to the opener), opened through `useReopenable` (a fresh dialog per
  opening). Containers that are focused by script use `tabIndex={-1}`, never a tab stop.
- **Skip link** first in the page ("Skip to main content"), shown only when focused.
- **The note text:** Tab indents (BlockNote), so Escape is the way out (to the title);
  screen readers are told so by the editor's description.

## Layout
- **App shell:** sidebar (brand, "New note", note list, storage notice) + content pane.
- **Note page:** sticky translucent toolbar (back link on phones, save status, actions);
  a centred writing column whose title and notices share the editor's 54px side inset so
  text lines up.

## Checking a UI change (part of every task's Verify)
1. `pnpm shots` captures every screen in light and dark, desktop and phone, into
   `apps/web/screenshots/` (git-ignored). Add new screens to
   `apps/web/e2e/visual/screens.spec.ts` when a task adds UI.
2. Look at the images: alignment, hierarchy, spacing, contrast, both themes, phone
   layout, long titles.
3. **Accessibility:** add the new screen or state to `apps/web/e2e/a11y-scans.spec.ts`
   (axe, WCAG 2.2 AA, light and dark, desktop and phone) and make sure it works with the
   keyboard alone (focus visible, never lost; see "Focus and keyboard" above and
   `docs/ACCESSIBILITY.md`).
4. e2e tests select by role and label, not by class, so restyling never breaks them.
5. After visible changes, re-record the README media with `pnpm demo` (Chromium) and
   review the preview frames it writes to `apps/web/screenshots/demo/`.
