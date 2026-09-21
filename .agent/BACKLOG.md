# Durable Backlog

Historical phase list — superseded by implementation reality (42-game
catalog, Workout V3 signal-ranked templates over the V2 template engine,
full progression/portability shipped; see
`docs/PARITY_MATRIX.md`). Campaign 031 (`031-golden-path-redesign`) is
validated; the owner-authorized 056–067 overnight program is COMPLETE
(historical completed object in `.agent/GOVERNANCE.json` `activeProgram`;
ledger `.agent/OVERNIGHT_056_067_STATE.md`); durable current state lives in
`.agent/STATE.md`. This file records durable work outside the terminal campaign
plus historical follow-ups.

## Still-open durable items

- Owner product decision (from Change 062, 2026-09-20): exported backup
  files live in the files domain and Android auto-backup carries them
  under the default `allowBackup=true` (only the `database` domain is
  excluded by `with-android-backup-rules`; no explicit `allowBackup`
  manifest attribute is pinned in-repo — the TRUE value rides the
  platform default, verified by inspection). Decide whether to exclude
  `backups/` from cloud auto-backup (and/or keep device-transfer) or
  keep current behavior; the Data Management header now discloses the
  real story either way. Changes restore semantics — do not implement
  without explicit owner direction.
- iOS build validation when a macOS/Xcode environment exists (static
  compatibility maintained source-level today).
- SAF share/picker consent sheets require an interactive manual QA path;
  external ARTEMIS does not replace explicit/manual consent review.
- Deferred product decisions (see `docs/DEFERRED_DECISIONS.md`) stay untouched
  until the owner decides.
- Coverage thresholds (deferred by Change 065, 2026-09-21): the Jest pipeline
  has no `collectCoverage`/`coverageThreshold`; critical trees (`db`,
  `data-portability`, `workout`, `rating`, `quests`) have no per-module floor.
  Owner: release-engineering orchestrator; decide the infrastructure cost and
  thresholds in the post-067 hardening phase. The skip/floor/console gates are
  the current substitute.
- Backup file rename durability (deferred by Change 065):
  `data-portability/file-transport.ts` writes a temp file then renames with no
  fsync, so a sudden power loss can lose the new backup after the old one was
  replaced. Owner: release-engineering orchestrator; fix if expo-file-system
  exposes fsync, otherwise rotate a `.prev` copy. Post-067 product/data
  decision.
- Snapshot review debt (deferred by Change 065):
  `apps/mobile/src/app/__tests__/visual-baselines.test.tsx` holds the only
  snapshots (one ~304 KB file) with a history of wholesale `-u` regenerations;
  no review mechanism exists. Owner: release-engineering orchestrator; review
  or replace with targeted assertions in the post-067 hardening phase.
- v12 rating-history repair semantics (deferred by Change 065): the v12
  migration keeps the earliest duplicate `rating_history` row per
  session/domain without reconciling `domain_ratings` or archiving the dropped
  movement. Owner: release-engineering orchestrator; either rebuild
  `domain_ratings` from retained history or record an explicit accepted
  mismatch. Requires schema work; post-067.
- Layering: `content/registry.ts` imports two game modules' pack validators
  (Change 066 recon F2). Owner: release-engineering orchestrator; generate or
  register the bundled pack-source list from game metadata so the Content
  Platform does not depend on specific games (needed only if games become
  removable).
- Type-only import cycle cluster `db ↔ workout ↔ personalization ↔ rating`
  (Change 066 recon F1): runtime graph is acyclic; the remaining edges are
  intentional type imports. Owner: release-engineering orchestrator; break via
  leaf type modules only if a module extraction is planned.
- Test-only UI components (`Avatar`, `ScreenHeader`, `LevelCard`, `StreakCard`,
  `ResultRow`/`StatRow`, `LiveRegion`) have no product importers (Change 066
  recon F10). Owner: product/release-engineering; adopt or drop in the post-067
  hardening phase. Do not delete while tests depend on them.
- UI-automator partial-tree race (tooling bound, recorded 2026-09-21): the
  `uiautomator --compressed` dump can miss a mid-transition node (observed on
  the vigilance pause control). Closure criterion: a rerun with an explicit
  settle wait reproduces or clears it; otherwise keep as tooling-noted and
  prefer semantic retries in device lanes.
- Jest-skip waivers (5 opt-in probes) now name `release-engineering
  orchestrator` as renewal owner and expire 2027-03-31; review them at the next campaign boundary (recorded by Change 066).
- Terminal-recert Low residuals (post-067 convergence, 2026-09-21; all with
  focused regression tests where applicable):
  - R1-F1 silent non-advance on reroll interleave — accepted Low debt:
    when a paid reroll replaces the current leg between result load and the
    advance commit, the session is safe but the leg needs a replay with no
    error disclosure. Follow-up: recheck-after-advance disclosure reusing the
    existing "Workout progress could not be saved" path, carefully excluding
    the benign duplicate-surface `advanced:false` case.
  - R2-F4 jest floor width — accepted buffer: `minTotalSuites 575` /
    `minTotalTests 6840` sit ~23 suites / ~93 tests below the certified
    counts; exact per-entry pinning (schema v4) covers the skip path. Tighten
    only with the same reviewed-owner/expiry treatment as entries.
  - R3-F7 paid-reroll lost-confirmation double-charge edge — accepted by
    design (bounded to the reroll flow): optional follow-up is a
    ledger-winner re-read before debiting a retried reroll.
  - R3-F8 storage permissions without `maxSdkVersion` scoping — accepted Low
    debt: neutered under scoped storage; scope or document when the aapt2
    deny-by-default gate can be re-run against a fresh APK.

## Resolved

- Lint warning inventory: RESOLVED in Campaign 013 — repo lints at
  0 errors / 0 warnings (was ~430–474); no blanket suppressions.
- Campaign 024 follow-up — shared answer-feedback language: COMPLETED in
  Campaign 025 across all game boards (31 remaining boards mapped on top of
  the Campaign 024 canaries).
- Campaign 024 follow-up — HUD round progress: COMPLETED in Campaign 025;
  `GameHost.roundProgress` is wired in 41/42 games, with
  `memory-sequence-memory` intentionally keeping the round chip (time-boxed
  score attack, no round total).

## Campaign 024 follow-ups (added 2026-09-12; reconciled 2026-09-13)

Deferred, non-blocking, and only worth doing with a reason:

- Consider a virtualized list for the Games library if the catalog grows well
  beyond 42 entries; the current chunked grid renders fine at this size.
- Richer Progress visualizations (line charts with axes, per-domain sparklines)
  once real usage data exists to justify them.
- Re-run the full-catalog `--mode certify` gate on a host with a single attached
  device to convert today's blocked classification into evidence.

The Campaign 027 W2 bounded hot-path and export work is closed (027/028
VALIDATED); the items above remain outside any campaign.
