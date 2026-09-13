# Proposal — Campaign 028: Production-Readiness Closure

## Why this campaign

Campaign 027 closed VALIDATED at `212469d` and the product matrix is green.
Four fresh read-only audits on `1733458` confirmed there is no Critical or
High product defect, but found a bounded set of real, executable gaps that
stand between the current state and release confidence:

1. **User-action failure paths that fail silently.** The primary Home workout
   CTA, rewards cosmetic purchase/equip, and profile milestone/quest/achievement
   claims still log to console and show nothing when the underlying action
   rejects. Their Campaign 027 siblings were fixed; these were missed.
2. **Data-portability robustness gaps.** The 027 export-canonicalization
   deferral is now obsolete (`exportLocalDataBundle` already proves a
   byte-identical single pass), quest/achievement foreign keys are not
   cross-validated at import, and a picked backup file is fully read into
   memory before the size guard runs.
3. **QA harness navigation unreliability.** The autobot deep link is never
   verified; a dropped `onNewIntent` under a cold bundle silently becomes a
   false failure (the recorded 4/8 and 6/8 canary runs), the patient
   pause-retry branch marks success without verifying, pre-warm is manual, and
   `qa-artifacts/` grows unbounded (671 MB locally).
4. **Validator/CI gate integrity gaps.** The dependency-audit allowlist policy
   mandates an expiry for `runtime-accepted-debt` but the gate never reads
   `expires`; IMPACT_MAP and `validate-affected.mjs` have drifted with only a
   row-count guard and the checker never runs in CI; `validate-repo-state.mjs`
   fails open on task ownership; the offline validator's comment heuristic
   skips any line containing `*`.
5. **Residual truth/cleanup debt.** Contradictory KNOWN_ISSUES prose, a stale
   DEFERRED_DECISIONS transport note, an untracked constitution promise
   (password-encrypted backups — recorded as deferred, not implemented), three
   unreferenced files, two copy/a11y nits, and four games missing a `hooks`
   unit test.

## What this campaign is

A release-confidence closure: fix the residual silent-failure paths, close the
portability robustness gaps, make the QA harness navigation verified and
self-cleaning, make every gate enforce its own stated policy, truth the docs,
remove dead weight, and re-run the complete validation stack plus runtime
canaries on the closure head. Campaign 027 already did the deep work; 028
closes what 027 surfaced, deferred, or left unpolished.

## What this campaign is not

- No new games, no new features, no design/UX redesign, no dependency churn.
- No constitution-deferred systems (cloud/auth/AI/monetization/notifications).
- No password-encrypted backup implementation: constitution §7 says
  "eventually support"; it is recorded as an explicit deferred decision in
  `docs/DEFERRED_DECISIONS.md` and `docs/PARITY_MATRIX.md` instead.
- No weakening of tests/guards to make anything pass.

## Expected outcome

- Every remaining silent user-action failure surfaces truthfully to the user
  and is pinned by a test.
- Export is single-pass with byte-identity already proven in-tree; import
  rejects cross-FK-invalid backups with a typed validation error; picked files
  are size-checked before read.
- The autobot verifies deep-link arrival, retries disclosed, pre-warms
  scheduled canaries/certify, verifies pause dismissal on every branch, and
  prunes only its own old run directories under explicit safety guards.
- The dependency gate fails closed on expiry after 2026-12-31, the offline
  validator catches aliased/reassembled calls, IMPACT_MAP cannot silently
  drift, and repo-state cannot silently skip ownership binding.
- Docs and registers describe reality; unreferenced files are gone.

## Exit criteria

All in-scope tasks complete or explicitly deferred with evidence; the full
Jest matrix, `tsc`, lint, every validator, OpenSpec and the QA harness
self-tests green at the closure head; runtime canaries and the daily-workout
journey PASS on the closure head (or honestly NOT VALIDATED with reasons); no
introduced Critical/High regression; durable state updated; commits pushed.
