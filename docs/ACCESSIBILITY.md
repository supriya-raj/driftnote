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

## Screen readers

**Structure.** One `h1` (Driftnote); landmarks: the sidebar (`complementary`, with
`navigation` "Note navigation"), `main`. The open note is an `article` named by a heading
with its title (visually hidden: the visible title is a text field), so heading
navigation finds it. Pop-ups are `dialog` (share, profile) or `alertdialog` (delete),
named by their headings; the delete confirmation's explanation is its description.

**Announcements** (polite live regions, `src/a11y/announce.tsx`), for changes that happen
without focus moving:

| When | Spoken |
|---|---|
| The connection drops | "You're offline. Changes are saved in this browser and will sync later." |
| It is back and everything is synced | "Back online. Your changes are synced." |
| A share link is created | "Edit/View link created and selected. Copy it to share the note." |
| A link is copied (or the clipboard is blocked) | "Link copied." / "Link selected. Press Cmd+C to copy it." |
| A link is revoked | "Link revoked. It no longer opens this note." |
| A note is deleted | "“Title” deleted." |

Not spoken on purpose: "Syncing… / Synced" (it flips with every edit). A modal dialog
hides the rest of the page from screen readers, so each dialog has its own live region
and announcements go to the one in front. Refusals that stop syncing, the storage warning
and the read-only notice are `role="alert"` and are read at once.

**Names.** Everything interactive has a name (axe checks this); also: profile colours are
named ("Teal"), people behind "+N" are listed by name, the editor is "Note text".

**Motion.** With "reduce motion" set in the operating system, animations and transitions
are off (`base.css`).

Tested in `apps/web/e2e/announcements.spec.ts` (through the accessibility tree: roles,
names, descriptions and live-region text; what a screen reader actually says is checked
by hand, see the manual audit).

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

## Audit (2026-11-25, T64)

What was done: every screen walked with the keyboard only (the tests in
`keyboard.spec.ts` and `m5a-accessibility.spec.ts` script this walk in three browsers),
and the accessibility tree (what a screen reader reads) of the note page, share dialog,
viewer, delete confirmation and profile dialog read through line by line.

| Finding | Outcome |
|---|---|
| Most buttons showed no focus ring (variant shadows replaced it) | Fixed (T62) |
| Tab could not leave the note text | Fixed: Escape leaves it, the editor's description says so (T62) |
| Focus fell to `<body>` after delete, after going back on a phone, after a revoke | Fixed (T62) |
| The update banner covered the profile button on phones | Fixed (T61) |
| Escape then a quick Enter did not reopen a dialog | Fixed (T62) |
| The editor's key hint was read again as text, and told viewers that Tab indents | Fixed: a hidden description, only on editable notes (T64) |
| Headings and bullet lists inside a note are exposed as BlockNote renders them | Known limitation (below) |
| Saved-link fields are named "Link 3 (can edit)" (a server number) | Kept: unique and says what the link can do; revisit if it confuses |

Not done by Claude: listening with a real screen reader. That is the owner's checklist
below.

### VoiceOver checklist (macOS, about 10 minutes)

Turn VoiceOver on and off with **Cmd+F5**. VO = Control+Option. In Safari, use
Option+Tab between controls (or turn on Settings → Advanced → "Press Tab to highlight
each item").

1. Open the app. Press VO+U, choose *Landmarks*: expect the sidebar, "Note navigation" and
   main. Choose *Headings*: "Driftnote", "All notes".
2. Tab once: "Skip to main content, link". Press Enter: VoiceOver moves to the main area.
3. Go to "New note" and press Enter: you hear "Title, edit text". Type a title, press
   Enter: "Note text, edit text … Tab indents. Press Escape to leave the text."
4. Type a line, type `/`: the block menu opens and VoiceOver reads the highlighted item;
   arrow down reads the next. Escape closes it; Escape again lands on the title.
5. Open Share: "Share this note, dialog". Create a view link: you hear "View link created
   and selected…". Copy: "Link copied." Escape: back on "Share, button".
6. Turn Wi-Fi off: within a few seconds, "You're offline. Changes are saved…". Turn it
   back on: "Back online. Your changes are synced."
7. Delete the note: "Delete this note?, alert dialog … It will be removed from this
   browser…", focus on Cancel. Confirm: "“Title” deleted." and focus on "New note".
8. Open "You: …": the colours read as "Blue, radio button", and so on.

Write anything that sounds wrong or confusing in `docs/PROGRESS.md` (open questions).

## Known limitations

- **Inside a note, structure is BlockNote's.** A note's own headings start at level 1
  (under the note's level-2 heading), and bullet and numbered lists are read as
  paragraphs with "•" rather than as lists with a count. Changing that means changing
  how BlockNote renders blocks; patching its DOM from outside would fight the editor
  (ProseMirror owns that DOM). Candidate for an upstream issue, or for the Ariakit UI
  variant that ADR 003 suggested evaluating.

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
