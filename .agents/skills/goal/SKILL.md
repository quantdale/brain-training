---
name: goal
description: Execute or resume the repository's planner-generated development campaign while preserving its native agent and governance rules.
type: prompt
whenToUse: When the user asks to continue, resume, execute, or finish the current repository development goal or campaign.
disableModelInvocation: false
---

# Repository Goal Executor

Use `$ARGUMENTS` as the user's goal-mode arguments.

1. Read all applicable `AGENTS.md` and repository governance instructions.
2. Read `.agent/PLANNER_HANDOFF.md`.
3. Read `.agent/EXECUTION_PROMPT.md` if present.
4. Read any native `.agent/GOAL.md`, `.agent/CURRENT_CAMPAIGN.md`, state files, OpenSpec state, execution plans, or other files required by the repository's existing instructions.
5. Inspect the current branch/worktree, recent commits, and implementation before changing code.
6. If the planner prompt is `ACTIVE`, reconcile it against work completed since `Planned-From`, then resume the first genuinely incomplete requirement.
7. Execute autonomously across the coherent campaign. Preserve existing behavior unless an intentional requirement says otherwise; avoid unrelated rewrites.
8. Run the prompt's required tests and integration/E2E validation. Never fabricate a pass. Repair introduced Critical/High regressions before completion.
9. Update the repository's durable state at meaningful checkpoints and commit/push according to its existing Git policy.
10. Mark the execution prompt `COMPLETED` only when its acceptance criteria and completion gate are actually satisfied. Mark/document `BLOCKED` only for a genuine blocker.
11. If no active planner prompt exists, fall back to the repository's native continuation mechanism. If none exists, report that a planner pass is required instead of inventing a major campaign.

Repository-specific instructions remain authoritative wherever they are stricter than this shared workflow.