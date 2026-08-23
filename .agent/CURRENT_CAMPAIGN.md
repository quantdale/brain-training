# Campaign 012 — Broad Convergence and Release-Candidate Preparation

**Status:** ACTIVE (opened 2026-08-22)
**Campaign id:** `012-broad-convergence-release-prep`
**Predecessor:** `011-full-validation-hardening` (COMPLETED at `b8ca36f`; 42/42 device PASS,
Jest 5750/0, TS/lint 0, doctor 21/21)
**Mode:** day (default; owner did not select night)

## Mission

CONSOLIDATE → COMPLETE → SIMPLIFY → DEEPEN → PREPARE FOR RELEASE.

1. **P1 — GameHost migration:** 18/42 migrated, 24 legacy. Migrate in similarity batches
   (A simple timer/response, B medium multi-round, C complex board/spatial/content,
   D special lifecycle) + consolidate the host abstraction. Target 42/42; correctness
   beats numeric completion.
2. **P2 — Workout V2 complete product:** short/standard/extended/focus flows, resume,
   history, completion summary, picker UX, device harness traversal (short-template
   traversal deferred from 011).
3. **P3 — Content debt:** equation-builder 8 dead easy templates ([10,3,4]→26 etc.) plus
   a global dead-content audit across the catalog.
4. **P4 — Release polish:** Home/Games/Workout/Progress/Rewards/Profile/Results/Game
   Detail/Data Management coherence. No uncontrolled redesign.
5. **P5 — Performance maturation** where measured (sync scan limit 5000 investigation).
6. **P6 — Build determinism:** permissions/backup-rules/prebuild reconstruction audit.
7. **P7 — Dependency audit** (controlled; no broad SDK upgrade).
8. **P8 — iOS static preparation** (source-level only; build stays NOT VALIDATED).

## Topology

16 worker packets in `.agent/_tasks/campaign012/` with strict disjoint ownership;
workers never branch/worktree/commit/push. Parent owns Git, shared files, generated
registries, schema ordering, durable state, cross-worker interfaces, integration, full
gates, and ALL emulator/device journeys (one Metro / one autobot / one device owner).

Waves (day-mode ceiling ≤7 concurrent coders): W01–W07+parallel audits first, then the
remainder; workers reused for second-wave cleanup where scope remains.

## Exit criteria

- [x] GameHost migration fully completed (42/42) with per-batch validation (wave 1, `0669f8e`)
- [x] Workout V2 short/standard/focus/resume/history flows implemented; device automation written (W06/W07/W08)
- [ ] Device journeys run by parent: migrated-game canaries/journeys + workout template journeys (PENDING — parent closeout)
- [x] Dead math content fixed (9 dead templates, permanent tripwire); global content audit completed CLEAN (37 non-math games swept)
- [x] UX/settings/release surfaces matured without redesign churn (W11/W12; zero snapshot drift)
- [x] Build configuration audited; prebuild determinism evidenced (W14, two-run temp-dir proof + hashes)
- [x] Dependency audit delivered; approved changes applied and validated (W15 report → pins lifted, doctor 21/21)
- [x] iOS static compatibility improved; build honestly NOT VALIDATED (W16; requires macOS/Xcode)
- [x] Final full gates green (repo-state, registry --check, provenance, ownership, offline, tsc, lint, Jest test:ci 469/5781 PASS, expo-doctor 21/21); web export + OpenSpec re-run pending at closeout
- [ ] If GameHost reaches 42/42: strong-preference full 42-game Android catalog run (PENDING — parent closeout, needs dev-client rebuild first)
- [ ] Durable state synchronized; release-blocker inventory recorded (in progress at closeout)

## Deferred product decisions (unchanged — do not activate)

Branding, account provider, Supabase production, cloud sync deployment, premium pricing,
ads, AI provider/pricing, social, notification schedule, store listing timing.
