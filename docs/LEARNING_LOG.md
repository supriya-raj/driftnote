# Learning log

Short, dated notes on what I learned, surprises, and mistakes. Newest first. Spike findings
(execution plan `S` tasks) are recorded here too.

---

## 2026-11-20: Note list cache (T12)

**A cache must be rebuildable to be droppable.** Ordering by "last updated" only survives a
rebuild if the note itself records when it was updated, so `meta.updatedAt` moved into the
doc. Everything in the list is a copy of something in a note.

**Closures hide assignments from TypeScript.** `let flag = false` set inside a callback is
still seen as `false` afterwards (TypeScript does not know when the callback runs), so the
linter called the `if (flag)` "always falsy". An object property avoids the false alarm.

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
