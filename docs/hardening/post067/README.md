# Post-067 hardening phase — evidence root

This directory is the evidence home for the Phase 2 hardening campaign
that follows the certified 056–067 program (program prompt §Phase 2).

## Structure

- `PASS_A_STATIC.md` — static/architecture/contracts/security/blind-spots
- `PASS_B_RUNTIME.md` — runtime/lifecycle/persistence/recovery/perf
- `PASS_C_RELEASE_UX.md` — release/UX/a11y/hostile-sequences/production gaps
- `RESIDUAL_CENSUS.md` — running census and dispositions
- `CONVERGENCE_LOG.md` — fix → validate → reassess waves until convergence
- `HARDENING_CLOSURE.md` — terminal verdict for the phase

## Seed material

- `docs/redesign/evidence/campaign066/RESIDUAL_CENSUS.md` (Pass A/B/C
  items with evidence and recipes)
- `docs/redesign/evidence/campaign067/TERMINAL_LEDGER.md` (NOT VALIDATED
  lanes and accepted debt)
- `docs/redesign/evidence/campaign067/DEFERRAL_DISPOSITION.md`

## Rules

- No new features; close correctness/robustness gaps only.
- Every fix lands with a focused regression test or deterministic gate.
- Critical/High regressions are repaired before the phase can close.
- Never fake green: unrun checks are NOT VALIDATED.
