# Execution Prompt — Campaign 028: Production-Readiness Closure

**Status:** VALIDATED
**Change:** `028-production-readiness`
**Planned-From:** `1733458`
**Start-SHA:** (activation commit)
**Planned-At:** 2026-09-13
**Target-Branch:** `main`
**Predecessor:** `027-deep-hardening` (VALIDATED)

## Mission

Execute the owner's Autonomous Successor Campaign Directive as the first
successor campaign after 027: close the residual release-confidence gaps that
four fresh read-only audits found on the 027 closure tree, re-validate the
full stack, and push evidence-backed progress. No new product features; no
constitution-deferred systems; no password-encrypted backups (recorded as an
explicit deferred decision instead).

## Why this is the best next campaign

027 closed VALIDATED with a green matrix, but its own audits and durable
registers left a bounded set of real, executable gaps: user actions that still
fail silently, a data-portability deferral whose blocking rationale is now
proven obsolete plus two untracked robustness gaps, an autobot that cannot
distinguish a dropped deep link from a product failure (directly producing the
recorded 4/8 and 6/8 canary runs) and grows 671 MB of artifacts unbounded, and
validator gates that do not enforce their own written policies
(dependency-audit expiry, IMPACT_MAP drift, repo-state fail-open, offline
false negatives). These are exactly the items an experienced reviewer would
raise before approving a release, and every one is executable in this
environment.

## Repository findings (evidence basis)

Recorded with file/line references in
`openspec/changes/028-production-readiness/audit-map.md`; every item traces to
one of the four audits (app surface, data portability, autobot harness,
validators/CI) or to `.agent/KNOWN_ISSUES.md` / `.agent/BACKLOG.md`.

## Behavior to preserve

- All gameplay, scoring, difficulty, generators, persistence formats,
  navigation, tutorials, and the visual identity are untouched.
- The public portability engines and their byte-identity contracts stay
  intact; the only format-adjacent change is stricter import validation that
  rejects cross-FK-invalid data earlier with a typed error.
- All existing tests keep passing; no guard is weakened; no skip is added.
- Existing evidence artifacts (campaign026/027 captures, curated dirs) are
  never pruned or overwritten.

## Scope / ordered workstreams

1. **W1 user-action reliability** — route failure surfacing + tests
   (`apps/mobile/src/app/(tabs)/index.tsx`, `rewards.tsx`,
   `(tabs)/profile.tsx`, matching `__tests__`).
2. **W2 data-portability robustness** — single-pass production export,
   quest/achievement FK cross-validation, pre-read pick size guard, preview
   re-entrancy, collision-resistant backup names
   (`apps/mobile/src/data-portability/**`, `app/data-management.tsx`).
3. **W3 QA harness reliability** — `scripts/qa/autobot.mjs` verified deep-link
   retry + route classifier + pause symmetry + scheduled pre-warm + bounded
   retention; offline self-tests; `ui-capture` reuse where natural.
4. **W4 validator/CI hardening** — `scripts/validate-dependency-audit.mjs`
   expiry/schema enforcement; `scripts/validate-offline.mjs` heuristic +
   self-test; `scripts/validate-affected.mjs` structured sync + CI;
   `scripts/validate-repo-state.mjs` fail-open removal + script-existence
   check; `scripts/certification/validate-jest-signal.mjs` staleness;
   `scripts/certification/certify-clean-checkout.mjs` gate parity;
   `.github/workflows/repository-integrity.yml` weekly schedule.
5. **W5 cleanup + docs truth** — dead file removal, KNOWN_ISSUES /
   DEFERRED_DECISIONS / PARITY_MATRIX corrections, copy/a11y nits, four
   missing `hooks.test.ts`.
6. **W6 verification** — full matrix, lint, every validator, OpenSpec; runtime
   canaries + daily-workout journey + a11y audit on `emulator-5560`.
7. **W7 closure** — adversarial diff review, durable state, push.

## Out of scope

- New games/features, UX redesign, dependency upgrades/churn, package
  changes.
- Constitution-deferred systems and password-encrypted backups.
- External evidence classes (store signing, manual TalkBack, SAF sheets,
  physical device, iOS runtime) — recorded, never faked.
- Owner-side repo administration (branch protection, Dependabot) — remains a
  recommendation.

## Implementation constraints

- Follow `AGENTS.md`, the locked constitution, governance and the packet's
  explicit write-ownership (orchestrator owns `scripts/**`, `.agent/**`,
  `openspec/**`, `docs/**`, `.github/**`; packets own their app surfaces).
- Retries must be bounded, traced and disclosed; failures must name cause.
- No force-push; commit coherent waves; keep `main` buildable.

## Migration / data requirements

None. No schema, format, or data migration is introduced. Import validation
becomes stricter (rejecting previously-accepted malformed backups earlier
with a typed error); no valid v1 backup changes behavior.

## Test requirements

- Every repaired handler/validator/harness behavior gets a regression test
  that fails on the old behavior (unit or self-test).
- Data-portability byte-identity suites stay green after the single-pass
  migration.
- Harness pure helpers covered by the offline `--self-test` CI runs.

## Integration / E2E validation

- Full Jest matrix, `tsc`, lint, all validators, OpenSpec at the closure head.
- Runtime on `emulator-5560`: scheduled-prewarm canaries, daily-workout
  journey, a11y audit; artifacts under `qa-artifacts/`.
- Any unavailable runtime evidence is recorded NOT VALIDATED with reasons.

## Acceptance criteria

All `tasks.md` items complete or explicitly deferred with evidence; every
spec scenario satisfied; no introduced Critical/High regression; matrix and
validators green at the closure head; docs/state truthful.

## Completion gate

The campaign closes only when the full validation stack and runtime evidence
are green (or honestly classified) at a pushed closure head, durable state is
synchronized, and no in-scope executable item remains.

## Git requirements

Coherent commits pushed to `origin/main` as waves land; no history rewrite;
no temporary branches/worktrees left behind; closure commit records evidence.

## Final report requirements

Recorded in `.agent/VALIDATION.md` (campaign section) and the closure commit
message: workstreams completed, evidence, validation classifications, and any
remaining external blockers.
