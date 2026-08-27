# Autonomous Handoff — Campaign 016

Pull the latest `main`, read `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`, `.agent/CAMPAIGN016_AUDIT.md`, and `openspec/changes/016-release-certification-hardening/EXECUTION.md`.

Execute the dependency order in `tasks.md` for one long autonomous session.

Critical rule: **do not activate 016 until Campaign 015 is truthfully closed and both GitHub workflows are green on the exact 015 closure SHA.**

After activation, prioritize:
1. clean-checkout reproducibility;
2. clean Android native prebuild/build;
3. macOS/iOS build-smoke CI;
4. bounded Android emulator recovery and fresh current-head certification;
5. CI skip/console-warning signal hardening;
6. runtime/data resilience and dependency/security classification;
7. performance/accessibility evidence;
8. exact-SHA final certification and durable state synchronization.

Do not add games or expand into constitution-deferred cloud/auth/AI/monetization/social/store-release features. Repair regressions immediately. Never label unavailable device evidence PASS. Continue into hardening/certification until all P0/P1 in-scope work is complete or a genuine external blocker is durably proven.
