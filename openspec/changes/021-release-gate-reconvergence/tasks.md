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

- [x] 3.1 Run the complete local gate matrix on the candidate SHA (validators,
      OpenSpec, ownership, registry, provenance, offline, secrets, TypeScript,
      lint, full Node 22 Jest, Jest signal, QA self-test, focused DB/workout
      suites, web export, Expo Doctor, clean-checkout certification).
      Evidence: `4734fa0` — Jest 6100/6105 (5 allowlisted skips), cert PASS.
- [x] 3.2 Android runtime non-regression on the dedicated `braintraining-qa36`
      AVD. Evidence: guard self-heal proven on the live DB (19→drop→19 after
      restart); canary `math-fast-math` PASS on the patched build.
- [x] 3.3 Verify all four workflows on the final pushed SHA; repair every newly
      exposed repository-owned failure. Evidence: all four green at `05c16bc`
      (App CI `33936913057`, Repository Integrity `33936913032`, Android Build
      Smoke `33936913090`, iOS Build Smoke `33936913050`).
- [x] 3.4 Targeted whole-codebase audit (CI/shell/env assumptions, native
      pins, persistence invariants, provenance, governance references); fix
      real in-scope defects. F1 crash-window fix landed (`4734fa0`); F2 audit
      confirmed write paths already fail-closed.

## 4. Truth repair and closure

- [x] 4.1 Synchronize `STATE`, `VALIDATION`, `KNOWN_ISSUES`, `GOVERNANCE`,
      `CURRENT_CAMPAIGN`, `EXECUTION_PROMPT`, and OpenSpec to observed
      evidence with SHA/run attribution.
- [x] 4.2 Close 021 only on green current-head evidence; return the repository
      to the explicit terminal form. All four workflows green at final SHA
      `05c16bc`; closure governance/terminal-state commit follows and its own
      workflow wave must be observed green.
