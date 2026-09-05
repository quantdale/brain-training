# Execution Prompt — Campaign 021: Release-Gate Re-convergence

**Status:** VALIDATED — terminal closure on final SHA `05c16bc`
**Change:** `021-release-gate-reconvergence`
**Start-SHA:** `e77da39` (head declaring 020 terminal with Android Build Smoke red at run `33930455910`)
**Planned-At:** 2026-09-05
**Target-Branch:** `main`
**Predecessor:** `020-release-qa-convergence` (VALIDATED)

## Objective

Repair the red Android release gate at root cause without weakening it, add a
permanent static guard for the SIGPIPE/exit-masking failure class, re-prove the
full automated matrix and all four repository workflows on the final candidate
SHA, verify Android runtime non-regression on the dedicated AVD, and reconcile
every durable status claim with SHA/run-attributed evidence.

## Required order

1. Root-cause fix + workflow hygiene validator (fail-closed).
2. Complete local regression matrix on the candidate SHA.
3. Dedicated-AVD canaries when the host can boot `braintraining-qa36`.
4. Push coherent waves; converge all four workflows at current head.
5. Targeted whole-codebase release-readiness audit; fix real defects.
6. Truth-repair durable state; close 021 only on current-head green evidence.

## Stop conditions

Stop for a user decision only on a genuine external blocker (infrastructure,
credentials, absent platform hardware) proven with concrete evidence. Never
convert unavailable evidence into PASS. No games, no deferred systems, no gate
weakening.
