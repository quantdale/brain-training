# Planner/Executor Handoff Adapter

This repository participates in the shared planner → GitHub → executor workflow.

Preserve and obey the root `AGENTS.md` and every repository-specific governance/state file. This adapter is additive and never weakens stricter local rules.

When the user enters `/goal continue` (or an equivalent continuation request):

1. Read `.agent/PLANNER_HANDOFF.md`.
2. Read `.agent/EXECUTION_PROMPT.md` if present.
3. Read the root/scoped `AGENTS.md` files and the native campaign/state/OpenSpec files they require.
4. Reconcile the execution prompt with the actual current Git and implementation state.
5. If the execution prompt is `ACTIVE`, resume it from the first genuinely incomplete requirement and continue autonomously through validation, durable-state updates, commits, and pushes required by repository policy.
6. If it is absent or completed, fall back to this repository's existing continuation semantics.
7. If neither exists, do not invent a major campaign; report that the repository planner must create the next execution prompt.

Do not redo already-landed work, do not perform unrelated rewrites, and do not declare completion with known Critical/High regressions.