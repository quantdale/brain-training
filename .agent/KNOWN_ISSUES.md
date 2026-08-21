# Known Issues / Blockers

## Current blockers

- **Campaign 010 validation debt (campaign-level, by design)**: the entire 010 wave
  landed implementation-only. Full Jest, lint, builds, emulator QA, benchmarks and
  device flows are NOT RUN for everything listed in
  `.agent/_tasks/campaign011-validation-backlog.md`. Nothing from 010 may be labeled
  HARDENED / PRODUCTION VERIFIED. Highest-risk areas: GameHost migrations (18 games),
  analytics projection SQL equivalence, backup file transport on device, workout V2
  lifecycle.
- **spatial-grid-nav QA force-win unreachable via automation (Medium, QA-tooling,
  open)**: on-device, grid-nav's shared PauseOverlay renders but its Resume/Quit
  buttons never appear in the uiautomator tree (title/buttons absent while the
  overlay node is present), so the harness cannot resume or force-win. The game
  itself launches, plays, and pauses correctly; all 9 unit suites pass. The sibling
  games with identical overlay code are verified. NOTE: grid-nav is NOT yet
  GameHost-migrated; its overlay now differs from the 18 migrated games' host-mounted
  overlay — re-verify after any migration wave. Root cause needs on-device
  React-tree inspection.
- **data_extraction_rules / backup_rules XMLs are untracked (Low, environmental)**:
  `android/` is gitignored (CNG prebuild). W15's local manifest trim + extraction-
  rule XMLs exist only in this working tree; they must be re-applied — or codified
  into a small Expo config plugin — before any clean `prebuild`. The durable fix is
  the expo-audio plugin config in `app.json` (committed).
- **expo-doctor patch drift + dependency removals (Low)**: doctor's patch-version
  advice predates 010; 010 REMOVED @expo/ui, expo-glass-effect, expo-device,
  expo-image, expo-web-browser, expo-status-bar, expo-system-ui (verified zero src
  imports and zero transitive requirers; expo-linking kept — expo-router dep).
  App boot after removals NOT VALIDATED — first item for the 011 emulator pass.
- **Post-010 CI confirmation pending**: GitHub App CI + Repository Integrity auto-run
  on push to `main`; final post-010 SHA must be confirmed from GitHub Actions UI.
  Expected: typecheck/lint/registry/provenance gates should pass; Jest may surface
  failures in areas 010 changed deliberately (migrated screens, math content tests) —
  those are Campaign 011's first work items, not blockers to revert.

## Open debt (tracked, non-blocking)

- **Performance findings (009 measured → 010 implementation)**: `loadProgressSnapshot`
  SQL projection path + repository primitives implemented in 010 (targeted the
  101 ms @20k debt); backup single-pass serializer + file transport implemented.
  Both NOT VALIDATED / NOT RE-MEASURED — Campaign 011 owns equivalence tests and
  benchmark re-runs (`scripts/perf/` baselines unchanged).
- **equation-builder dead easy-level templates (Low, 010 finding)**: eight
  pre-existing 3-number templates requiring × are unreachable because easy's +/−
  operator mix always fails their solvability filter ([10,3,4]→26, [8,7,3]→53,
  [6,5,4]→54, [9,4,2]→38, [7,6,3]→45, [10,5,2]→52, [8,6,4]→44, [13,2,5]→31).
  Prune or re-tier in a content campaign.
- **GameHost migration remainder (Medium)**: 24 of 42 games still pre-GameHost
  (mechanics work fine; boilerplate remains). Migrate in batches during 011 with
  screen suites as guardrails.
- **iOS build unverifiable on this host (NOT VALIDATED)**: Windows host has no
  Xcode/macOS. Static audit refreshed in 009; 010 added platform seams (safe-area,
  keyboard adapters) that are source-level only.
- **Achievements sync scope (Low)**: quest/achievement evaluation scans up
  to 5000 recent sessions (`SYNC_SESSION_SCAN_LIMIT`); far above realistic
  foundations-phase history, but a documented cap.
- **NativeTabs snapshot instability (tooling)**: router-tree snapshots
  contain per-render random `screenId`s; visual baselines render bare
  routes to stay deterministic (see visual-baselines test header).
- **Host NDK / provenance-allowlist / warning-class handling (Low, 006R)**:
  unchanged from 008; see `VALIDATION.md` history. The `src/games` eslint
  warnings stay warnings (0 errors enforced).

## Resolved during Campaign 009

- **logic-deduction-table ambiguous rounds (Critical)**: uniqueness prover
  enumerated only the first two consistent permutations; 8 counterexamples
  produced shipped-but-ambiguous puzzles. Exhaustive sound enumeration +
  regression suite pinning a counterexample.
- **db v8 migration startup brick (Critical)**: append-only trigger aborted
  the operation_id backfill transaction; duplicate legacy 'gameplay' rows
  violated the partial unique index. Collision-safe atomic backfill with
  trigger restore.
- **Invisible-profile restore (High)**: backups with foreign profile ids
  created a second, unreadable profile row on import; normalized to the
  local singleton.
- **Silent SFX failure (High, UX)**: context-fit and cue-shift correct/wrong
  sounds never played in production (names missing from `SFX_ALIASES`);
  aliases added with SDK-level invariant tests.
- **attention-target-count pause exploit (High)**: pause+resume restarted the
  full round window → unlimited think time and inflated scores; freeze-and-
  continue accumulator adopted (gameVersion 1.1.0).
- **speed-color-match timing (High)**: wall-clock reaction measurement and
  pause window accounting replaced with monotonic clock paths (1.0.1).
- **stroop defect cluster (High)**: unanswerable neutral trials,
  session-ending first timeout, dead-ended flip-cue phase, fabricated RTs,
  capped perfect-run score, inexact force-win — all fixed with regressions.
- **task-switch/rule-flip generator determinism bugs (Medium)**: constant
  fork salts made every round/block identical; round-/block-scoped salts.
- **fold-match degenerate distractors (Medium)**: keep-base contradiction.
- **Reroll on completed workouts (Medium)**: debited coins for nothing;
  refused now. `paidReroll` balance checked inside its transaction.
- **Shield unusable standalone (Medium)**: delegated to Freeze/Recovery
  predicates and consumed the wrong item; correct item now consumed.
- **equation-builder undo (Medium)**: undo of trailing operator left an
  impossible token state; re-derived from remaining tokens (1.0.1).
- **word-chain degenerate-pool crash (Low)** + content ambiguity fixes
  (context-fit non-word/ambiguous items, truncated idioms).
- **QA harness stale catalog (Medium)**: hardcoded 24-game list replaced by
  game.json derivation + registry cross-check; scales with catalog growth.

## Resolved during 008

See Git history / VALIDATION.md (Wave 02 recovery convergence; canary PASS
after Metro cache clear).

## Resolved during 006R / earlier

See Git history and prior entries in this file's archived sections in
`VALIDATION.md`.
