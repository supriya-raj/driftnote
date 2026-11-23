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
- **Accessible by default:** visible focus rings, text contrast that meets WCAG AA,
  real buttons and links, `prefers-reduced-motion` respected.

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
| Text | `--text`, `--text-muted`, `--text-faint` |
| Accent | `--accent`, `--accent-hover`, `--accent-soft`, `--accent-text`, `--on-accent` |
| Status | `--danger*`, `--warning-*`, `--info-*`, `--success` |
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
| Toast | `.toast` (`UpdatePrompt.css`) | Non-blocking app messages, bottom right (full width on phones). |
| Empty states | `EmptyState`, `.note-missing` | Soft icon tile, short heading, one sentence, optional action. |
| Note list | `Sidebar.tsx` | Title + relative time; whole row clickable (stretched link); active row raised. |

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
3. e2e tests select by role and label, not by class, so restyling never breaks them.
4. After visible changes, re-record the README media with `pnpm demo` (Chromium) and
   review the preview frames it writes to `apps/web/screenshots/demo/`.
