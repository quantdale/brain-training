# Durable Project State

**State schema:** 1
**Last update:** 2026-08-16 (Campaign 002 COMPLETED)
**Canonical branch:** `main`
**Active campaign:** `003-platform-integration` (Phase 3 — staged; next continuation goal executes it)

## Current status

**Campaign 002 (Eight Representative Games, Phase 2) is COMPLETED.** All exit
criteria verified on the dedicated AVD `braintraining35` and in CI
(see `.agent/checkpoints/002-eight-representative-games-complete.md` and
`.agent/VALIDATION.md`). Deliverables:

- Seven new game modules (attention-visual-search, speed-reaction-time,
  math-fast-math, language-word-match with versioned 72-item content pack,
  logic-next-sequence with solver-validated puzzles, flexibility-card-sort
  rule-switching state machine, spatial-mental-rotation) — each with SDK
  lifecycle/timing/pause/tutorial/QA-hooks/normalization/session persistence,
  semantic testIDs, deterministic tests (684 game tests).
- Rating engine (`src/rating/`): XP = (10 + 40·normalized)·difficulty
  multiplier; per-domain delta = k·(normalized − expected-by-difficulty),
  capped ±15/session, secondary domains at half weight; level curve
  50·L·(L−1) cumulative XP, no cap; 1 coin per 5 XP via the append-only
  ledger; stale-marking (no decay).
- DB schema v2: `domain_ratings`, append-only `rating_history` (FK +
  UPDATE/DELETE triggers), `game_favorites`; v1→v2 upgrade preserves rows;
  `RatingService` seam applied atomically inside `completeSession`.
- Shared platform UI: `/results` (session summary + rating movement +
  recent sessions), `/game-detail/[id]` (records, favorites, versions,
  Play CTA), Games library search + category chips + favorites-only filter,
  Progress analytics (level/XP/coins, 8 domain ratings with staleness,
  per-game aggregates, recent sessions).
- Today's Workout: deterministic daily 4-game selection with
  same-game-consecutive-day avoidance by construction and a free reroll.
- On-device QA: full loop played (tutorial skip → start → QA force-win →
  results → persistence) and verified in the pulled db: xp 50/session,
  Math 1020/Speed 1010 after 2 sessions, 2× +10 gameplay coins,
  favorites persisted; legacy campaign-001 session row preserved intact.
  Focus-refresh fix applied after QA findings (stale screens on navigation
  return).

## Completed campaign 002 (commits)

- `d0ff355` wave1: seven game modules + registry (8 games registered)
- `0c7690d` wave2: rating engine + db schema v2 + RatingService seam
- `2e439c5` wave3: shared platform UI (results, detail, search/filter, progress)
- `f5d8e01` wave4: Today's Workout (deterministic daily + free reroll)
- `0a16f68` wave5: focus-refresh for db-backed screens (QA findings)

## Next required action

Execute `.agent/CURRENT_CAMPAIGN.md` — Campaign 003 (Platform Integration +
Autonomy/Platform Gate, Phase 3): Today's Workout personalization/reroll
economics, quests/achievements, streaks + freeze/recovery, stronger Progress
dashboard, themes/cosmetics seams, content-pack/storage seams, offline
boundary tests, visual-regression baselines, performance/timing checks, first
iOS compatibility build, then run the constitution §32 gate. Do NOT enter
mass catalog expansion (Phase 4) before the gate is satisfied.

## Important invariants

- Android-first autonomous QA; iOS later compatibility campaign.
- One emulator by default (dedicated AVD `braintraining35`).
- No host mouse/keyboard automation.
- Up to ~7 coder agents where work is safely partitioned.
- No autonomous full hardening.
- No autonomous force-push to `main`.
- GitHub `main` is canonical (remote: quantdale/brain-training).

## Recovery note

A fresh agent should not require the chat that created this repository. Read
`AGENTS.md`, the constitution, governance JSON, current campaign, state,
validation, and recent Git history before working. Recovery is demonstrated —
see `docs/RECOVERY_DRILL.md`. Environment watch items (emulator stability,
screencap black frames, typed-routes regeneration) are in
`.agent/KNOWN_ISSUES.md`.
