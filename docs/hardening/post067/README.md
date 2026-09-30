# Post-067 hardening phase — evidence root

This directory is the evidence home for the Phase 2 hardening campaign
that follows the certified 056–067 program (program prompt §Phase 2).

## Structure

- `PASS_A_STATIC.md` — static/architecture/contracts/security/blind-spots
- `PASS_B_RUNTIME.md` — runtime/lifecycle/persistence/recovery/perf
- `PASS_C_RELEASE_UX.md` — release/UX/a11y/hostile-sequences/production gaps
- `CONVERGENCE_LOG.md` — fix → validate → reassess waves until convergence
- `TERMINAL_RECERT_CONVERGENCE.md` — post-hardening terminal re-certification
  (Wave 1–4) and its `NOT VALIDATED` device boundaries
- `FINAL_POST_HARDENING_CERTIFICATION.md` — terminal ledger: final matrix
  totals, artifact identity, and the device-lane disposition
- `HARDENING_CLOSURE.md` — terminal verdict for the phase

There is **no** `RESIDUAL_CENSUS.md` in this directory: the Pass A/B/C census
lives with its evidence under
`docs/redesign/evidence/campaign066/RESIDUAL_CENSUS.md` (see *Seed material*
below), and the phase's own convergence record is `CONVERGENCE_LOG.md`.

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
