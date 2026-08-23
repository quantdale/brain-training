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

1. **W1 — Repository-wide completion audit** (in progress): TODO/FIXME/
   stub/dead-code/silent-catch/unsafe-cast inventory across all routes, 42
   game modules, GameHost/SDK, persistence, engagement systems, QA infra,
   CI, docs. Status: initial sweeps clean (one stale TODO comment in the
   offline-boundary suite; silent catches are documented defensive patterns).
2. **W2 — Known-debt resolution**: schema v10 workout reasons persistence
   ✅ (+ backup round-trip); length-aware completion copy ✅; word-chain
   expert pool 9→18 ✅; deterministic versionCode/buildNumber ✅; lint error
   class eliminated (react-hooks v6) ✅; warning inventory reduction and
   NativeTabs snapshot seam still open.
3. **W3 — Persistence/migration hardening**: migration matrix tests exist
   (fresh + every prior version + corrupt user_version + rollback); extend
   with adversarial portability attacks as gaps are found.
4. **W4 — Lifecycle/concurrency**: advance idempotency, double-submit
   guards, pause/back interception already tested; continue attack-matrix
   passes (rapid taps, backgrounding, kill/relaunch) on device.
5. **W5 — Security/privacy**: offline boundary validator CLEAN (919 files);
   QA hooks isDevBuild-gated with throwing defaults; permissions audited
   (RECORD_AUDIO/SYSTEM_ALERT_WINDOW blocked at plugin source). Maintain.
6. **W6 — UX/a11y polish**: tutorial overlay fix materially improved small-
   viewport behavior; continue label/contrast/focus passes opportunistically.
7. **W7 — Release engineering**: deterministic version mechanics done;
   signing/publication stay deferred (no credentials by policy). Cold-clone
   path = npm ci + expo prebuild + assembleDebug verified this campaign.
8. **W8 — Documentation reconciliation**: README/MASTER_PLAN/BACKLOG/PARITY
   refreshed to implementation reality at closure.
9. **W9 — Final Android certification**: single-session 42/42 catalog run +
   full journey chain per game. IN PROGRESS — see KNOWN_ISSUES.md for the
   environment-interference history and the driver-lockfile fix that removes
   it structurally.

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
