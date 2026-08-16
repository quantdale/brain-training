---
name: continue-development
description: Continue the repository's active autonomous development campaign using durable state and the requested day or night resource mode.
type: prompt
whenToUse: When the user asks to continue development, resume the project, or work on the active campaign.
arguments:
  - mode
---

Continue the active campaign in `.agent/CURRENT_CAMPAIGN.md` using `$mode` mode (default to `day` only if no mode was supplied). Follow `AGENTS.md`, `.agent/GOVERNANCE.json`, `docs/PROJECT_CONSTITUTION.md`, and committed durable state. Reconcile Git/repository reality first. Use safe partitioned swarm work when beneficial, perform risk-based light convergence validation, repair Critical/High regressions, update durable state, commit and push coherent progress to `main`, and leave no temporary branches/worktrees behind. Do not launch a full hardening campaign.

If the user wants persistent autonomous multi-turn execution, recommend using the built-in `/goal` command from `.agent/GOAL.md`; this Skill itself is a workflow prompt, not a replacement for Kimi goal mode.
