# Learning log

Short, dated notes on what I learned, surprises, and mistakes. Newest first. Spike findings
(execution plan `S` tasks) are recorded here too.

---

## 2026-11-21: Spike S20, tabs and unknown blocks

**Question 1: does the stock provider keep two tabs in sync while offline? Yes.**
`y-websocket` 3.1 connects its `BroadcastChannel` (same-origin tab messaging) whenever the
provider *wants* to connect, independent of the WebSocket. With the server unreachable, an
edit in one "tab" reached the other. Only an explicit `provider.disconnect()` stops it, so
the client must not call `disconnect()` just because the network dropped. Caveat: the
check ran two providers in one Node process, where lib0 delivers to same-context
subscribers directly; T36's e2e test with two real tabs covers the cross-tab path.
Also useful for T32: 3.1 has a `shouldReconnect(event)` option and a `closed` event with
the close code, for terminal codes like 4401/4410.

**Question 2: what does BlockNote do with block types it does not know? It deletes them
from the shared document.** Injected `callout` (unknown) and `image` (removed from our
schema) blocks were removed from the Yjs doc by `y-prosemirror` on render, silently. A
`paragraph` with an unknown attribute was kept. The read-only gate (T17) did not help:
the deletion happens when the document is turned into the editor's view, not on editing.
Consequences: gated notes now render a disposable copy (fix to T17), and an ADR 012
amendment (proposed) ties `schemaVersion` bumps to protocol-version bumps so outdated
clients are refused by the server.

**Spike hygiene.** Spike code (a scratchpad script, a temporary hook, temporary tests) was
deleted; only these findings are kept. One trap on the way: loading Yjs twice (`require`
and `import` in one script) breaks it; the first run "showed" no sync for that reason.

## 2026-11-20: Design baseline (T19)

**Tests that select by role survive a redesign.** The whole UI was restructured (sidebar
layout, new components) and not one e2e test changed: they find "the button named New
note" or "the list named Notes", never a CSS class or DOM position.

**Look at the screens, don't just run the tests.** Screenshots caught what tests cannot:
an in-note heading bigger than the note title, a focus ring boxing the whole editor in
dark mode, and a warning that took a third of the sidebar.

**Design tokens make dark mode one switch.** Components only use variables like
`--surface` and `--text`; the dark theme redefines the variables, not the components.
BlockNote exposes its colours the same way (`--bn-colors-*`), so it was mapped onto ours.

## 2026-11-20: Cross-browser (T18)

**Stub on the prototype, not the instance.** In WebKit, `navigator.storage.persist = fake`
in an init script "worked" (no error) but the app later saw the native method: the engine
recreated the JavaScript wrapper object, losing properties set on it. Replacing
`StorageManager.prototype.persist` survives that. Firefox and Chromium were fine either
way, which is exactly why the plan runs every milestone in all three engines.

## 2026-11-20: A flaky suite and its real cause (T17)

**Passes alone, fails together: look for shared load.** Offline tests passed on their own
and failed in the full run. A 4x repeat took 39 minutes with Chrome failing to *launch*:
the machine was heavily loaded (load average 72 on 8 cores, largely other apps). The test
suite made it worse: every fresh context installed the service worker and downloaded the
whole ~5 MB precache from one `vite preview` process. Fix the cause, not the timeout:
service workers are blocked except in the tests about offline. 105/105 in 33 s after.

**Read-only is a safety feature.** A newer app may store content this one cannot
represent; editing could silently drop it. Old clients look, but do not touch
(`meta.schemaVersion`), and they also skip their own automatic `updatedAt` write.

## 2026-11-20: Safe links (T16)

**The dangerous link is the one you did not type.** Editors filter links on paste and
typing, but in a CRDT app content also arrives as document updates from other replicas,
which skip those filters. The test injects a link straight into the Yjs fragment.

**Defence in depth, each layer tested by removing it.** BlockNote already renders invalid
links with `href=""` and its toolbar refuses `javascript:`. We narrowed the allow-list
(BlockNote's default also allows ftp, tel, sms, ...), replaced the click handler (the
default opened the emptied link, i.e. the current page, in a new tab) and styled emptied
links as text. `new URL(href).protocol` is used instead of a prefix check, because
browsers ignore leading whitespace/control characters (`" javascript:..."`).

## 2026-11-20: Offline app shell (T14)

**A service worker only helps from the second load.** The first visit downloads the app
and installs the worker, which caches every built file ("precache"). Tests therefore wait
until the worker controls the page before going offline. `clientsClaim` lets the first
install take over open pages without a reload.

**SPA fallback.** Offline, `/n/<id>` is not a file in the cache. The worker answers any
in-app navigation with the cached `index.html` and the client-side router shows the page.
Server paths (`/api`, `/sync`) are excluded so the worker never fakes them.

**"Expected to fail, but passed" is good news.** The acceptance test went green in T14, so
`test.fail()` turned the run red on purpose. Switch it to a normal test in that task.

## 2026-11-20: Note list cache (T12)

**A cache must be rebuildable to be droppable.** Ordering by "last updated" only survives a
rebuild if the note itself records when it was updated, so `meta.updatedAt` moved into the
doc. Everything in the list is a copy of something in a note.

**Closures hide assignments from TypeScript.** `let flag = false` set inside a callback is
still seen as `false` afterwards (TypeScript does not know when the callback runs), so the
linter called the `if (flag)` "always falsy". An object property avoids the false alarm,
but not across an `await` (T13): TypeScript keeps a property narrowed after awaiting.
Reading the flag through a function call (`isCancelled()`) is never narrowed.

**Red step skipped by accident, then repaired.** I wrote T12's code before running its
tests. Fix: stash the implementation, run the tests (red), restore. For a test whose
failure was masked by an earlier step, disable just that feature and re-run.

## 2026-11-20: Editor and local persistence (T11)

**Knowing when IndexedDB has saved.** `y-indexeddb` writes every update in its own
transaction but gives no "saved" callback. IndexedDB runs transactions that touch the same
store in creation order, so a read-only "barrier" transaction created right after the
write completes only once the write has committed. That drives `data-local-state`, which
tests wait on instead of sleeping.

**Test that an "absence" test can fail.** "No Image item in the slash menu" passes
trivially if the menu never opens or the label pattern is wrong. Two guards: assert a
present item first (Heading 1), and temporarily restore the media blocks to watch the
test go red.

**Strict flags vs library types.** `exactOptionalPropertyTypes` makes "missing" and
"`undefined`" different. Libraries rarely write types for it; BlockNote's fail even
against themselves. Turned off for web code only.

## 2026-11-20: Expected failures and timeouts

**A timeout is not a failure in Playwright.** `test.fail()` expects the status "failed";
a test that runs out of time ends "timed out", which is reported as unexpected. The first
M1 acceptance run waited 30 s for a missing button and broke. Fix: `actionTimeout` (10 s)
turns a stuck click into an ordinary failure, and fails faster with a pointed error.
In the list reporter an expected failure shows as `✘` with "1 passed" in the summary.

## 2026-11-20: Phase 0 setup lessons

**GitHub protects workflow files separately.** A token with `repo` scope can push code but
not files under `.github/workflows/`; that needs the extra `workflow` scope, because a
workflow can run arbitrary code with the repo's secrets. GitHub checks every commit in a
push, so one commit touching a workflow blocks the whole push even if a later commit
removes it. We dropped the unpushed commit from local history and moved CI to the end.

**TDD: "red for the right reason".** In the web smoke test, the page title check passed and
only the heading check failed. That shows the test fails because of the missing behaviour,
not because of an unrelated breakage (wrong URL, server not started).

**Type-aware linting catches real async bugs.** With typescript-eslint's type-checked
rules, calling an async function without `await` is an error (`no-floating-promises`).
In sync code, a forgotten `await` on a save is exactly how data gets lost quietly.

## 2026-11-12: Toolchain surprises

**TypeScript 7 is a rewrite, and the ecosystem lags.** `pnpm add typescript` installed 7.x
(the Go-native compiler). typescript-eslint, which plugs into the compiler's API, only
supports `<6.1`, so we pinned TypeScript 6.0.x. Lesson: check peer-dependency ranges
before adopting a new major version.

**pnpm blocks dependency install scripts by default.** Packages can run code when
installed, which is a supply-chain risk. pnpm refuses unless the package is allow-listed
(`allowBuilds` in `pnpm-workspace.yaml`). Only `esbuild` is allowed: it installs its native
binary.

**nvm's default alias can follow "latest".** Installing Node 26 silently changed the
machine's default Node because the default alias pointed at `node` (latest installed). The
project uses `.nvmrc` + `nvm use` instead, and the default was pinned back to 18.
