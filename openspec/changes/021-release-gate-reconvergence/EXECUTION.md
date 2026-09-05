# Execution Entry — Campaign 021 Release-Gate Re-convergence

**Status:** ACTIVE
**Change:** `021-release-gate-reconvergence`
**Baseline:** `e77da39` (head declaring 020 terminal while Android Build Smoke was red)
**Target branch:** `main`
**Predecessor:** `020-release-qa-convergence` (VALIDATED)

## Mission

Restore agreement between declared and executable release status: repair the
red Android release gate at root cause without weakening it, add a permanent
static guard for the masking/SIGPIPE failure class, re-prove the full
automated matrix and all four workflows on the final candidate SHA, verify
Android runtime non-regression on the dedicated AVD, and make every durable
statement cite SHA/run-attributed evidence.

## Execution order

1. Root-cause and fix the Android Build Smoke setup failure (fail-closed).
2. Add `scripts/validate-workflows.mjs` + self-test; gate it in Repository
   Integrity.
3. Run the complete local regression matrix on the candidate SHA.
4. Android runtime canaries on `braintraining-qa36` when the host can boot it.
5. Push coherent waves; converge all four workflows on the final SHA; repair
   every newly exposed repository-owned failure.
6. Targeted whole-codebase release-readiness audit; fix real defects.
7. Truth-repair durable state; close 021 only on current-head green evidence.

## Scope guard

No game #43, product expansion, signing/store work, cloud/auth/AI/monetization,
or other constitution-deferred system is in scope. Tests, validators, and build
gates may be strengthened, never weakened.

## Stop conditions

Stop only for a proven external blocker (infrastructure, credentials, absent
platform hardware). Never convert unavailable evidence into PASS.
