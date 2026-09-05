# Tasks — Campaign 021 Release-Gate Re-convergence

## 1. Root-cause repair

- [x] 1.1 Reproduce/diagnose the exact Android Build Smoke failure from runner
      logs and workflow history; confirm producer-side SIGPIPE under pipefail.
- [x] 1.2 Remove the redundant license acceptance; keep the pinned install
      fail-closed with an installed-packages postcondition.

## 2. Regression guard

- [x] 2.1 Add `scripts/validate-workflows.mjs` with `--self-test` covering
      `yes |` pipes, `|| true` masking, and redundant `sdkmanager --licenses`.
- [x] 2.2 Wire it into Repository Integrity and verify green on GitHub
      (run 33930455858 at 1a946a9: 16/16 self-test, integrity green).

## 3. Full convergence wave

- [ ] 3.1 Run the complete local gate matrix on the candidate SHA (validators,
      OpenSpec, ownership, registry, provenance, offline, secrets, TypeScript,
      lint, full Node 22 Jest, Jest signal, QA self-test, focused DB/workout
      suites, web export, Expo Doctor, clean-checkout certification).
- [ ] 3.2 Android runtime non-regression on the dedicated `braintraining-qa36`
      AVD (or honest NOT VALIDATED if the host cannot boot it).
- [ ] 3.3 Verify all four workflows on the final pushed SHA; repair every newly
      exposed repository-owned failure.
- [ ] 3.4 Targeted whole-codebase audit (CI/shell/env assumptions, native
      pins, persistence invariants, provenance, governance references); fix
      real in-scope defects.

## 4. Truth repair and closure

- [ ] 4.1 Synchronize `STATE`, `VALIDATION`, `KNOWN_ISSUES`, `GOVERNANCE`,
      `CURRENT_CAMPAIGN`, `EXECUTION_PROMPT`, and OpenSpec to observed
      evidence with SHA/run attribution.
- [ ] 4.2 Close 021 only on green current-head evidence; return the repository
      to the explicit terminal form.
