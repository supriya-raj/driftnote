# Driftnote: working agreement

See prd @ PROJECT_BRIEF.md

This is a learning project. The goal is for me (the human) to understand every decision, not just to ship. Be a patient teacher: define terms, explain new concepts and tradeoffs plainly, and never decide anything significant silently. 

## Current mode: architecture discussion (no code yet)
We start with a discussion phase. During it:
- **Write no application code and do not scaffold the repo.**
- Walk me through the key architectural decisions one at a time. Likely topics: CRDT library, editor, local storage, sync/server topology, sharing and identity model, version history, frontend toolchain and monorepo setup, testing strategy. Propose additional topics if you see gaps.
- For each decision, present at least 2-3 real options (including ones you would not pick). For each option give a plain-language explanation, pros, cons, and when it is the right choice. Then give a recommendation and why. Ask me questions when the decision depends on my preferences.
- Record each decision as an ADR in `docs/adr/NNN-title.md` (context, options with pros/cons, decision, consequences). Keep status `Proposed` until I say it is accepted. Never mark an ADR `Accepted` yourself.
- Also write up the overall architecture (components, data flow, a diagram) in `docs/ARCHITECTURE.md` once the main decisions are made.

## Exiting the discussion phase
When I say the architecture is settled, and only then:
1. Create `docs/EXECUTION_PLAN.md`: phases and tasks derived from the accepted ADRs and `PROJECT_BRIEF.md`. Every task needs an ID, a goal, a deliverable, and a verification command or check, and must be safe to re-run.
2. Create `docs/PROGRESS.md`: current phase, a task status table, a single "Next action", decisions log, open questions, and a short handoff note.
3. Show me both and wait for my approval before starting any implementation.
4. Add the two files to the top of this file's imports (`@docs/EXECUTION_PLAN.md`, `@docs/PROGRESS.md`) and change the "Current mode" section to the implementation protocol below.

## Implementation protocol (applies after step 4 above)
**Session start, every session, in order:**
1. Read `docs/PROGRESS.md`. It is the only memory between sessions. Never rely on chat history.
2. Verify it against reality: `git status`, `git log --oneline -10`, and run the repo's checks. If notes and repo disagree, trust the repo, fix `PROGRESS.md`, and tell me what you corrected.
3. Tell me in 3-5 lines: current phase, last completed task, and the single next action.

**Idempotency rules:**
- A task is done only when its verification passes.
- Tasks must be re-runnable. Check before creating files, folders, dependencies, or config.
- One task per commit, with the task ID in the message (`feat(T12): ...`). Conventional commit prefixes.
- No destructive operations (deleting files, force pushes, resetting history, dropping data) without asking me first.
- If a task is interrupted, mark it `in-progress` in `PROGRESS.md` with notes on what exists. On resume, inspect the repo and finish it rather than redoing it.
- New significant technical choices get an ADR and my approval first.

**After every task and before a session ends:** update `docs/PROGRESS.md` (task status, next action, decisions, open questions, handoff note) and commit it with the work.

## Style
- Work in small, reviewable steps and commit after each, using conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`).
- Before each milestone, state the plan in 5-10 lines and wait for my OK.
- Write tests alongside features.
- Prefer boring, well-typed code: TypeScript strict mode, no `any` without a comment.