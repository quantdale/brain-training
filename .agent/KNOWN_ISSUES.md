# Known Issues / Blockers

## Current blockers

- **spatial-grid-nav QA force-win unreachable via automation (Medium, QA-tooling,
  open)**: on-device, grid-nav's shared PauseOverlay renders but its Resume/Quit
  buttons never appear in the uiautomator tree (title/buttons absent while the
  overlay node is present), so the harness cannot resume or force-win. The game
  itself launches, plays, and pauses correctly; all 9 unit suites pass. The
  sibling games with identical overlay code are verified (transform-match and
  mental-rotation PASS after the `accessible`-grouping fix in the shared
  PauseOverlay — which was itself a real a11y defect: TalkBack could not focus
  Resume/Quit individually). Root cause needs on-device React-tree inspection;
  top candidate for the next QA wave. Harness reports this honestly as
  "app left paused: resume control not reachable" instead of a misleading
  qa-toggle failure.
- **12.11 / CI confirmation pending**: GitHub App CI + Repository Integrity auto-run on push to `main`; final post-009 SHA must be confirmed from GitHub Actions UI after promotion. Note: the new OpenSpec CI step downloads `@fission-ai/openspec@1.6.0` via npx at run time (exact-pinned).
- **expo-doctor patch drift (Low, environmental)**: doctor reports 20/21 — patch-version advice for @expo/ui, expo, expo-linking, expo-router. Dependencies are byte-identical to origin/main (no 009 dependency change); left unpinned to avoid upgrade churn. Revisit at next dependency-audit campaign.
- **Host NDK toolchain pinned per-host (SDK patch, reversible)**: unchanged from 008; see open debt below and `VALIDATION.md`.

## Open debt (tracked, non-blocking)

- **Performance findings routed to debt (009, measured)**: `analytics/queries.ts`
  `loadProgressSnapshot` still loads full rows (101 ms @20k sessions per
  Progress focus; projection/window-pushdown proposed by W13/W09);
  backup export canonicalizes the envelope twice (~2.4 s frozen JS @5k
  sessions; single-pass serializer proposed). Both functional today;
  guards + baselines recorded in `scripts/perf/`. Next candidates when
  large-history performance matters.
- **Unused native deps (Low, 009 audit)**: `@expo/ui`, `expo-glass-effect`,
  `expo-device`, `expo-image`, `expo-web-browser` have zero src imports
  (`expo-linking` likely required transitively by expo-router — verify before
  removal). Removal inflates iOS pod surface less; deferred to avoid
  dependency churn without a transitive-dependency check.
- **Android manifest permissions exceed product use (Low, 009 audit)**:
  RECORD_AUDIO / SYSTEM_ALERT_WINDOW / FOREGROUND_SERVICE(_MEDIA_PLAYBACK)
  appear injected via expo-audio plugin defaults; trim at the app.json plugin
  config source of truth during the next Android build campaign.
- **iOS build unverifiable on this host (NOT VALIDATED)**: Windows host has
  no Xcode/macOS. Static audit refreshed in 009
  (`docs/audits/campaign009-xplat-audit.md`: fix-now items applied at
  convergence — web tab inset, celebration elevation; watch-list and
  needs-macOS items documented there).
- **Attention sustained-vigilance game (follow-up candidate)**: mechanically
  distinct SART-style design evaluated but not built in 009 (session budget);
  top candidate for the next catalog wave.
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
