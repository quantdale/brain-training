# Universal Planner → Executor Handoff

Version: 1

This file defines a cross-agent handoff protocol without replacing this repository's existing product, architecture, governance, OpenSpec, campaign, state, validation, or Git rules.

## Canonical planner output

The reusable repository-planning skill writes the next execution-ready campaign to:

`.agent/EXECUTION_PROMPT.md`

That file is a planner-generated overlay, not a replacement for native control-plane files such as `.agent/GOAL.md`, `.agent/CURRENT_CAMPAIGN.md`, `.agent/STATE.md`, OpenSpec state, roadmaps, ADRs, or repository-specific execution plans.

An execution prompt should begin with machine-readable-looking metadata in plain Markdown:

- `Status: ACTIVE | BLOCKED | COMPLETED`
- `Planned-From: <commit SHA>`
- `Planned-At: <ISO date/time>`
- `Target-Branch: <branch>`

and then contain, at minimum: mission, why this is the best next campaign, repository findings, behavior to preserve, scope, out of scope, ordered workstreams, implementation constraints, migration/data requirements when applicable, test requirements, integration/E2E validation, acceptance criteria, completion gate, Git requirements, and final report requirements.

## Planner contract

The planner must inspect the repository's actual current state before writing the prompt. At minimum it should review relevant source/configuration, tests, documentation, recent commit history and diffs, open issues/PRs when useful, current agent/governance files, and any native campaign/state system.

The planner must:

1. build directly on completed work rather than duplicate it;
2. choose exactly one coherent, high-impact campaign substantial enough for a long autonomous session;
3. prioritize product value, dependency leverage, risk, maturity, and integration completeness rather than raw file-change count;
4. preserve existing working behavior unless the campaign intentionally changes it;
5. require appropriate automated tests plus integration/E2E validation for important behavior;
6. require no known Critical or High-severity regressions at completion;
7. integrate with this repository's native control plane instead of silently replacing it;
8. write/update `.agent/EXECUTION_PROMPT.md`, commit, and push the planning-only change according to repository Git policy;
9. stop after planning. The planner must not implement the campaign.

## Executor contract

When the user says `/goal continue`, `continue`, `continue working`, or invokes the shared `goal` skill/command with `continue`:

1. read all applicable repository `AGENTS.md`/governance instructions;
2. read this file;
3. read `.agent/EXECUTION_PROMPT.md` in full if it exists;
4. read the repository's native goal/campaign/state/OpenSpec files required by its existing instructions;
5. inspect current branch, worktree, recent commits, and actual implementation state;
6. reconcile the planned-from baseline with work already completed after that baseline;
7. if `EXECUTION_PROMPT.md` is `ACTIVE`, execute it autonomously from the first genuinely incomplete requirement;
8. do not redo work merely because the prompt predates later commits;
9. do not expand into unrelated rewrites or cleanup unless required for the campaign;
10. run the required tests/validation, repair introduced Critical/High regressions, and update durable state at meaningful checkpoints;
11. commit and push coherent progress according to the repository's existing Git policy;
12. when all acceptance criteria pass, mark the execution prompt `COMPLETED` and record completion evidence or a pointer to the repository's canonical validation/state record;
13. on a genuine external blocker, preserve useful work, mark/document `BLOCKED` where appropriate, push a recoverable checkpoint if repository policy allows it, and report the exact blocker.

Do not pause for ordinary low-risk implementation decisions. Investigate, follow repository patterns, choose the safest reasonable option, and continue.

## Fallback when no planner prompt is active

If `.agent/EXECUTION_PROMPT.md` is absent or already `COMPLETED`, use the repository's pre-existing native continuation semantics if they are defined. If neither an active planner prompt nor a native active campaign exists, do not invent a large new campaign during execution mode; report that a planner pass is required.

## Authority and compatibility

This protocol is additive. Explicit user instructions and stricter repository-specific instruction hierarchies remain authoritative. Existing architecture, security, release, validation, branching, and product constraints must continue to be followed.