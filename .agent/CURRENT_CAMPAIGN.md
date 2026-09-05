# Campaign 021 — Release-Gate Re-convergence

**Status:** VALIDATED — terminal repository state; external device/manual certification remains deferred
**Campaign id:** `021-release-gate-reconvergence`
**Predecessor:** `020-release-qa-convergence` (VALIDATED)
**Mode:** day
**Change:** `021-release-gate-reconvergence` (VALIDATED; `change.json` VALIDATED, `GOVERNANCE.activeCampaign` null, `STATE` and terminal ownership synchronized)
**Authorization:** explicit owner directive on 2026-09-05 activating a whole-repository current-head convergence campaign.

## Mission

Eliminate the contradiction between a declared terminal/VALIDATED repository
and its real executable evidence: repair the red `Android Build Smoke` release
gate at root cause without weakening it, guard the failure class statically,
re-prove the full automated matrix and all four workflows on the final
candidate SHA, verify Android runtime non-regression on the dedicated AVD, and
make durable status claims cite SHA/run-attributed evidence.

## Current execution state

Closed on final SHA `05c16bc` (2026-09-05). No campaign is active.

## Exit criteria — evidence

- Android clean native release build executes successfully end-to-end on the
  final pushed SHA, with APK size/permission boundaries and SHA-256 provenance.
  **MET** — run `33936913090` (also `33936169819`/`33935472497` on the fix
  waves): clean prebuild, release Gradle assembly, APK + permission checks,
  artifact upload with SHA-256 digest.
- The workflow hygiene guard is self-tested and gated in Repository Integrity.
  **MET** — `scripts/validate-workflows.mjs` 16-assertion self-test; green at
  `05c16bc` (`33936913032`).
- Full local matrix passes on the candidate SHA under the existing explicit
  Jest skip-measurement policy (never widened). **MET** — `4734fa0`: Jest
  6100/6105 (5 allowlisted skips only, `validate-jest-signal.mjs` PASS),
  validators, TypeScript, lint, Expo Doctor 21/21, web export, autobot
  self-test, clean-checkout certification.
- All four repository workflows green at current head. **MET** — App CI
  `33936913057`, Repository Integrity `33936913032`, Android Build Smoke
  `33936913090`, iOS Build Smoke `33936913050`.
- Android runtime evidence not regressed on `braintraining-qa36`. **MET** —
  on-device guard self-heal on the live DB plus `math-fast-math`,
  `speed-tap-rush`, `attention-odd-one-out` canaries PASS on the patched
  build. Physical-device/TalkBack/SAF/iOS-runtime evidence: DEFERRED per
  constitution, never recorded as PASS.
- Durable state matches observed evidence with no terminal-status
  contradiction. **MET** — this closure commit set.

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
