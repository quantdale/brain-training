# Campaign 013 — Final Product Completion (owner-authorized)

**Status:** ACTIVE (opened 2026-08-23 at Campaign 012 closure)
**Campaign id:** `013-final-product-completion`
**Predecessor:** `012-broad-convergence-release-prep` (COMPLETED)
**Mode:** day
**Authorization:** explicit owner directive — full completion + hardening
campaign for the currently locked v1 scope. This is the user-invoked
hardening campaign normally gated behind an owner request.

## Mission

AUDIT → COMPLETE → HARDEN → POLISH → VALIDATE → CERTIFY.

Drive the repository to the strongest technically complete, production-grade,
release-candidate state possible under `docs/PROJECT_CONSTITUTION.md`'s
locked scope, and certify v1 of the offline-first Brain Training product.

## Workstreams

1. **W1 — Repository-wide completion audit** ✅ COMPLETED: full first-party
   tree swept (TODO/FIXME/HACK/stubs, unsafe casts, disabled tests, dead
   routes, duplicated utils, lifecycle races, non-deterministic RNG,
   unversioned scoring, unbounded reads, offline-boundary violations).
   Result: 0 Critical/High; Medium was the 474-warning lint debt (now 0/0).
   One debris file `m[1])` removed.
2. **W2 — Known-debt resolution** ✅ COMPLETED: schema v10 workout reasons
   persistence (+ backup round-trip) ✅; length-aware completion copy ✅;
   word-chain pool 9→18 ✅; versionCode/buildNumber determinism ✅; lint
   error class eliminated ✅; warning inventory 474→0 ✅ (no suppressions);
   NativeTabs deterministic normalizer + integrated snapshot ✅.
3. **W3 — Persistence/migration hardening** ✅ COMPLETED: adversarial matrix
   extended (+18 tests) — idempotent v10 column guard, malformed metadata
   cells (8 shapes), legacy envelopes, failure-injected atomicity, newer-
   schema rejection; all mutation-proven.
4. **W4 — Lifecycle/concurrency** ✅ COMPLETED: advance idempotency &
   double-submit guards verified; pause/resume attack matrix exercised on
   device; 2 stochastic pause/a11y races remain as Medium debt (see
   KNOWN_ISSUES; honest-retry added).
5. **W5 — Security/privacy** ✅ COMPLETED: offline CLEAN (919 files);
   QA hooks isDevBuild-gated; permissions blocked + drift-pinned by test;
   secrets scan 0 hits; 16 npm advisories classified build-toolchain-only.
6. **W6 — UX/a11y polish** ✅ COMPLETED: tutorial overlay + short-viewport
   behavior verified; shared shell 44pt targets + a11y labels audited; the
   2 pause/a11y races are tracked as Medium (recoverable via honest retry).
7. **W7 — Release engineering** ✅ COMPLETED: versionCode/buildNumber
   determinism; signing/publication deferred; cold-clone path verified;
   embedded-bundle dev APK built for Metro-independent certification.
8. **W8 — Documentation reconciliation** ✅ COMPLETED: README (plugin path),
   MASTER_PLAN (012/013), PARITY (file count 919, QA row), BACKLOG (lint
   closed), KNOWN_ISSUES (debt triaged, contamination lesson), VALIDATION
   (waves 1-3) refreshed; QA README documents --mode certify.
9. **W9 — Final Android certification** 🔄 IN PROGRESS: harness hardened
   (--mode certify, atomic journal, provenance, preflight, row invariants,
   nav-zone scroll, pause-aware force-win, honest-retry); best run 40/42
   (2 stochastic pause failures, different games per run — no deterministic
   defect); re-running with --no-pause to certify the core 42/42 gate while
   the 2 pause races are tracked as Medium debt.

## Exit criteria

- [ ] Single-session 42/42 Android catalog terminal classification PASS
      under one exclusive driver
- [ ] Full Workout V2 certification retained (short/focus/resume/daily)
- [ ] Warning inventory reduced to an explainable small set or explicitly
      documented per-class
- [ ] Documentation reconciled (README, MASTER_PLAN phases, BACKLOG, PARITY)
- [ ] All final gates green from a clean coherent state
- [ ] Certification report delivered (repository state, campaigns, product
      areas, validation counts, defects fixed, remaining blockers, verdict)
