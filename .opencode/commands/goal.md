---
description: Resume the repository's planner-generated or native active development campaign
---

Treat this as repository goal mode. Arguments: `$ARGUMENTS`.

Read the applicable `AGENTS.md` instructions, `.agent/PLANNER_HANDOFF.md`, and `.agent/EXECUTION_PROMPT.md` if it exists, plus every native campaign/state/OpenSpec file required by this repository.

If the arguments contain `continue` or are otherwise a continuation request, reconcile the prompt with the current branch, worktree, recent commits, tests, and actual implementation. If `.agent/EXECUTION_PROMPT.md` is `ACTIVE`, resume from the first genuinely incomplete requirement and execute autonomously until its completion gate is satisfied or a genuine blocker is durably recorded. Do not repeat work already landed after the planned baseline.

If no active planner prompt exists, use the repository's pre-existing continuation semantics. If no native active campaign exists either, do not invent a large campaign in executor mode; report that a planner pass is required.

Preserve stricter repository-specific rules, run required validation, fix introduced Critical/High regressions, and commit/push according to existing Git policy.