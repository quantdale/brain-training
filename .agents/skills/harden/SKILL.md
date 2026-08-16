---
name: harden
description: Run an explicitly requested hardening campaign at the requested scope without adding unrelated features.
type: prompt
whenToUse: Only when the user explicitly asks for hardening, deep QA, or a production-readiness campaign.
arguments:
  - scope
---

Run a hardening campaign for `$scope`. The user has explicitly invoked hardening, so freeze unrelated feature development. Follow `AGENTS.md` and the constitution. Choose risk-appropriate deep QA from cross-feature journeys, canary/full-game contracts, persistence, backup/restore when implemented, offline/network transitions, time manipulation, failure injection, visual regression, performance/stress, dependency/security checks, bug fixing, and regression reruns. Do not fake PASS for unavailable checks. Update durable validation/known-issues/state, commit and push coherent repairs to `main`.
