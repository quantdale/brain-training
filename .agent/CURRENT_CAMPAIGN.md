# Campaign 021 — Release-Gate Re-convergence

**Status:** ACTIVE
**Campaign id:** `021-release-gate-reconvergence`
**Predecessor:** `020-release-qa-convergence` (VALIDATED)
**Mode:** day
**Change:** `021-release-gate-reconvergence` (ACTIVE)
**Authorization:** explicit owner directive on 2026-09-05 activating a whole-repository current-head convergence campaign.

## Mission

Eliminate the contradiction between a declared terminal/VALIDATED repository
and its real executable evidence: repair the red `Android Build Smoke` release
gate at root cause without weakening it, guard the failure class statically,
re-prove the full automated matrix and all four workflows on the final
candidate SHA, verify Android runtime non-regression on the dedicated AVD, and
make durable status claims cite SHA/run-attributed evidence.

## Current execution state

At candidate `4734fa0`: the root-cause gate fix (`1a946a9`), workflow-hygiene
guard, QA probe fixes, and the whole-codebase audit F1 fix (`4734fa0`, schema-
guard crash-window self-heal) are landed. The full local matrix passed at the
candidate SHA (Jest 6100/6105 with only the 5 allowlisted skips; validators,
TypeScript, lint, Expo Doctor 21/21, web export, autobot self-test, and clean-
checkout certification all PASS). Android runtime re-verified on the dedicated
`braintraining-qa36` AVD: on-device guard self-heal proven on the live DB and
canary `math-fast-math` PASS. App CI and Repository Integrity are green at
`4734fa0`; Android and iOS Build Smoke completion remains the only open exit
evidence before closure.

## Exit criteria

- Android clean native release build executes successfully end-to-end on the
  final pushed SHA, with APK size/permission boundaries and SHA-256 provenance.
- The workflow hygiene guard is self-tested and gated in Repository Integrity.
- Full local matrix passes on the candidate SHA under the existing explicit
  Jest skip-measurement policy (never widened).
- All four repository workflows green at current head, or explicitly classified
  external with evidence.
- Android runtime evidence not regressed on `braintraining-qa36`, or honest
  NOT VALIDATED.
- Durable state matches observed evidence with no terminal-status contradiction.

## Scope guard

No game #43, content expansion, cloud/auth/AI/monetization/social system,
signing, store publication, or unrelated feature expansion is in scope.
Validators, tests, and build gates may be strengthened, never weakened.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`
7. `openspec/changes/021-release-gate-reconvergence/EXECUTION.md`
