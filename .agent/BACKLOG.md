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
- Backup physical durability — fsync (deferred by Change 065; **partly closed by
  Change 070, 2026-09-30**): the recorded deferral described ONLY the missing
  fsync, and recommended "otherwise rotate a `.prev` copy". That understated the
  problem: the transport was also losing data through a pure ORDERING window, not
  a physical one. `move(temp, dest, { overwrite: true })` is a
  **delete-then-rename** in the installed `expo-file-system` Android native code
  (sources and line references in
  `apps/mobile/src/data-portability/replacement.ts`), so a crash mid-write left
  the user with NO backup at that name, no error, and — because the listing rule
  hides dotfiles — no indication one was lost.
  - **Closed by Change 070:** the ordering window. Replacement is now
    write-temp → rotate old to `.prev` → rename new into place → verify the new
    content reads back → delete `.prev`. Every intermediate state leaves at
    least one complete readable copy, and the only gap is between the rotation
    and the rename, where the complete previous content is readable at `.prev`.
    Proven by fault injection at every step
    (`__tests__/replacement-crash-safety.test.ts`), including a mutation proof
    that the previous single-move sequence fails the same safety assertion.
    `.prev` leftovers are swept on the next write and on every listing pass, and
    a leftover that is the only surviving copy is reported to the user rather
    than deleted.
  - **STILL OPEN (this is the remaining item):** physical durability — getting
    the bytes onto storage needs an fsync, which `expo-file-system` does not
    expose. The rotation bounds the residual: a power loss can lose the newest
    backup's tail, but the previous complete backup survives to the next boot.
    Owner: release-engineering orchestrator; fix if the dependency ever exposes
    fsync, otherwise accept the documented bound explicitly. Post-067
    product/data decision.
- `react-native-reanimated` is imported by no first-party source — **NOT removable**
  (Change 071 reconciled the audit's premise, 2026-09-30). The audit listed it as
  an "unused native runtime dependency" to be deleted from `apps/mobile/package.json`.
  Measured before acting on that: it is a **peer dependency of `expo-router`**
  (`peerDependencies["react-native-reanimated"] === "*"`, read from
  `node_modules/expo-router/package.json`) and a transitive dependency of
  `react-native-drawer-layout`, and Campaign 012's dependency audit
  (`.agent/_tasks/campaign012/W15.md:127`) had already reached the same
  conclusion: "Zero direct imports but NOT removable: … (router peers + native
  autolinking + babel-preset-expo auto-plugin — verified zero src references via
  rg exit-1 sweep)". Deleting the direct declaration would leave a peer
  unsatisfied at the manifest level and change no runtime behavior, because the
  package still installs transitively. Per MASTER_PLAN §9.3 the plan step was
  not forced: the premise was wrong, so the change is **reverted and the finding
  recorded** instead. Owner decision needed only if a future Expo release drops
  the peer requirement; there is nothing to fix while it holds.
- Shared-kit coverage gaps (recorded by Change 071, 2026-09-30; partially
  corrected 2026-10-02): `Confetti`, `StateCard` and `SectionGrid` ship with no
  dedicated suite — that part is real untested surface. **Corrected:** the
  toast-queue claim ("drops its oldest message silently with no test pinning
  that behavior") was false — `kit-inputs.test.tsx` "061: bounds the pre-mount
  queue, dropping oldest first" has pinned it since Change 061. Owner:
  release-engineering orchestrator; add the three primitive suites when the kit
  is next touched rather than as a standalone coverage push.
- **SUPERSEDED 2026-10-02 (post-068–075 certification campaign, verified at
  `1565c2b` and later).** The entry below this marker was accurate when written
  (2026-09-30, `CHANGE_073_PARTIAL`) and is false now. Measured against the
  code in this campaign: §1.3's malformed/over-bound leg-list validation exists
  (`apps/mobile/src/db/workout.ts` `requireValidLegList`/`storedLegList`, enforced
  at `skipToLeg`), §2 durable ownership exists
  (`findSessionOwningWorkoutProvenance`), §3 skip exists (`skipToLeg` +
  schema v13 `skipped_indices_json`), §4 honest launches and §5 boot
  reconciliation exist (`reconcileWorkoutPositions` run at `initializeDatabase`).
  The only remaining item is the §6.3–6.5 device lane, which is owed evidence
  rather than implementation and is tracked in `.agent/VALIDATION.md`.
  The historical record follows unchanged.
- Change 073 remaining work (recorded 2026-09-30, `CHANGE_073_PARTIAL`): §1
  (one compare-and-set for workout position writes) is DONE and proven — both the
  session advance and the reroll now go through `db/workout-cas.ts`, which closed
  the reroll's missing `status='active'`, `updated_at` and `seed_version`
  predicates. NOT DONE: the malformed/over-bound stored leg-list VALIDATION
  (1.3's remaining half — the shared CAS detects a CONCURRENT rewrite via the
  stored bytes but does not reject an already-corrupt row before writing), §2
  durable leg ownership, §3 the skip/abandon transition and its migration, §4 the
  honest "Up next" launch, §5 startup reconciliation, and the §6.3–6.5 device
  lane. Owner: release-engineering orchestrator.
- **SUPERSEDED 2026-10-02 (post-068–075 certification campaign, verified at
  `1565c2b` and later).** The entry below was accurate when written and is false
  now: every listed "Remaining" item has landed. Measured in this campaign: §3
  per-game lifecycle verification scans the 42 game modules
  (`apps/mobile/src/sdk/__tests__/game-lifecycle-contract.test.ts`, `module-surface.ts`),
  §4's duplicate-start guard exists (`use-game-session.ts`,
  `duplicate-start-guard.test.tsx`), and §6's SDK module map is executable
  (`game-sdk-doc.test.ts`). The only remaining item is the §7.4 device lane —
  owed evidence, not implementation. The historical record follows unchanged.
- Change 074 device lane (recorded 2026-09-30, `CHANGE_074_PARTIAL`): §1–§6 are
  DONE and measured. Remaining: §3 per-game lifecycle verification (the contract test
  still satisfies itself from shared host sources rather than scanning the 42
  module directories), §4 the duplicate-start guard in `useGameSession.begin()`,
  §6 the `docs/GAME_SDK.md` module map and the stale catalog-size comment, and
  the §7.4 device lane. §4 (the duplicate-start guard) and §5 (the
  version-conversion contract) are also DONE.
  Owner: release-engineering orchestrator.
- **SUPERSEDED 2026-10-02 (post-068–075 certification campaign).** The entry
  below is unchanged and still accurate: the code sections of Change 072 are
  done and the device lane (tab-stack depth, Data Management/Game Detail back
  destinations, Results → Progress freshness) remains owed evidence on the
  dedicated AVD. This marker records that the entry was re-verified in this
  campaign and is not stale. Historical record follows unchanged.
- Change 072 device-lane boundary (2026-09-30, `CHANGE_072_PARTIAL`): every code
  section of the change (§1–§6) is DONE and measured. What remains is the
  device lane only: confirm on the dedicated AVD that repeated tab visits enter
  each destination once rather than stacking, that the new Data Management back
  affordance lands on Profile and game detail's lands correctly, and that a
  session completed on the results screen appears on Progress without waiting
  for a focus window. The source contracts are enforced by
  `apps/mobile/src/__tests__/navigation-contract.test.ts` and the
  `progress-focus-throttle` suite; the on-device behaviour is not claimed.
  Owner: release-engineering orchestrator.

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
- **CORRECTED 2026-10-02 (post-068–075 certification campaign).** The entry
  below (Change 066 recon F10) is stale: Change 071 (`5412e70`) deleted
  `Avatar`, `ScreenHeader`, `LevelCard`, `StreakCard`, the dead `GameCard`
  component, the dead `ResultRow` component, and the `A11yDialog`/`LiveRegion`
  exports. `StatRow` is live product surface (42 game screens import it).
  The historical entry follows unchanged; nothing in it is pending work.
- Removed-kit recoverability record (071 task 3.5, written 2026-10-02 — the
  checkbox was checked in 2026-09-30 but no record was ever filed here):
  `A11yDialog` and `LiveRegion` were deleted from `src/components/a11y` by
  Change 071 commit `5412e70`; `Avatar`, `ScreenHeader` (ui), `LevelCard`,
  `StreakCard` (shell), and the dead `GameCard`/`ResultRow` components by the
  same commit. All six are recoverable from that commit's history if a future
  screen needs the pre-built primitives.
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
