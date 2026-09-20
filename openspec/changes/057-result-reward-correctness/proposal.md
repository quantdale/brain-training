# Change 057 — Result & Reward Correctness

**Status:** IN_PROGRESS
**Predecessor:** `056-workout-lifecycle-integrity` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 056–058 product and behavioral completeness (result/reward correctness, game-to-game consistency, offline-visible behavior).

## Problem / evidence

Verified against current source at `c14d44d` (post-056):

1. **Corrupt stats abort finalization → session loss (HIGH).** All 42 games
   ship a local `clamp01` that throws `RangeError` on non-finite input
   (`games/*/scoring.ts`, 42 identical copies). Every screen's finalization
   effect calls its `normalize*Result` unguarded (`screen.tsx`, e.g.
   speed-tap-rush `:236`); a single NaN stat (glitched clock sample, corrupt
   reducer value, hostile QA force-state) throws before `buildSessionRecord`
   / `persist*Session`, so the played session is silently lost — no persist,
   no `persistence-failed` UI. This contradicts the pipeline's documented
   safe failure mode (`rating/pipeline.ts:119-132`: non-finite collapses to
   0, participation XP still granted, rating costs).
2. **In-game XP flickers 0 until the DB round-trip (HIGH).** All 42 screens
   default `xpHook = noopXpRatingHook` (`sdk/types/results.ts:72-76`, pinned
   by `sdk/contracts.test.ts:16`). The "Phase 2 replaces this" comment is
   stale — Phase 2 (rating pipeline, wired in `_layout.tsx:135-148`) already
   landed. Every completion renders `0 XP` until `completionOutcome`
   arrives; on slow/failed persistence the player sees a wrong reward.
3. **Personal-best universe diverges from the recent list (LOW).**
   `loadPersonalBest` (`app/results.tsx:85-104`) bounds with
   `toMs: session.completedAt` while every other read uses `Date.now()`. A
   clock-skewed future-dated session is invisible in recents yet compared
   against a different universe for PB. Same-ms ties are already handled
   (earliest holder) and the 055 honesty gate suppresses weak-PB
   celebration; the remaining defect is the unclamped upper bound.
4. **String-seed → 32-bit FNV provenance gap (MEDIUM, DEFERRED).** Intended
   for 060 (needs a schema migration; documented in non-goals).

## Desired invariant / outcome

- No `normalize*Result` throws on corrupt *data*: count/accuracy corruption
  degrades to worst-case 0, speed-only corruption degrades that term to 0
  (partial value), aggregation is stack-safe on hostile arrays. Helpers
  with explicit param validation keep throwing; games without param guards
  gain none. A glitched session persists with participation XP instead of
  vanishing.
- Every screen's optimistic XP equals the authoritative pipeline XP by
  construction (same `computeXp`, same normalized value, same difficulty
  level as the persisted record), so the first rendered reward is already
  correct; the DB outcome confirms rather than corrects.
- PB compares within the same time universe as the rest of Results
  (`toMs = min(completedAt, now)`).
- Scoring formulas, rating math (`computeXp`/`computeRatingDelta`/pipeline),
  economy, schema, backup format, gameplay, offline, and router behavior are
  unchanged. `noopXpRatingHook` keeps its exact semantics for test seams.

## Non-goals

- No scoring-formula, difficulty, generator, or XP-curve change.
- No optimistic rating *deltas* (screens render deltas only from
  `completionOutcome`; authoritative path unchanged).
- No seed-schema migration (→ Change 060 with merge-safety work).
- No encrypted backups, no backend, no store/manual evidence.
- `language-word-match` semantics untouched.

## Affected areas

`games/*/scoring.ts` (42, packet-owned per domain) + their scoring tests;
`games/*/screen.tsx` default hook (42, packet-owned); shared
`rating/xp-hook.ts` (orchestrator); `sdk/types/results.ts` stale comment
(orchestrator); `app/results.tsx` PB clamp (orchestrator);
`sdk/contracts.test.ts` (unchanged — noop preserved).

## Protected contracts

Pipeline math, `canonicalNormalizedResult` DB guard (still throws on
garbage — last line of defense), session atomicity/idempotency, rating
authority (`storedXp` override stays), workout/session identity,
unexpected-console baseline, generated registry, six-way a11y, dark intent.

## Implementation plan

1. Orchestrator: add `rating/xp-hook.ts` (`pipelineXpRatingHook`: XP via
   pipeline `computeXp`, empty deltas with documented rationale); fix the
   stale Phase-2 comment; PB `toMs` clamp + skewed-fixture test; strict
   OpenSpec pre-validation.
2. Domain packets (8, ≤7 parallel): per game —
   a. scoring.ts: data-driven `clamp01` collapses non-finite → 0 (keep
      programmer-error throws); update throw-pinning tests honestly; add
      corrupt-stats degradation tests (NaN stat → value 0, no throw).
   b. screen.tsx: default `xpHook` → `pipelineXpRatingHook` (import swap);
      verify finalization context difficulty === record difficulty level
      (parity condition — fix to profile level where divergent); run game
      screen/session/scoring suites, update xp-0 expectations honestly.
   c. Report: files, tests, parity verification, residual risk.
3. Orchestrator convergence: shared-file edits only here; full matrix;
   canary native spot-checks (representative games complete + persist);
   adversarial review; close.

## Test plan

- Per-game corrupt-stats tests (red→green where the throw exists today).
- Shared parity test: hook XP === pipeline outcome XP across difficulties.
- PB skew test (future-dated session).
- Full gated Jest + console gate + typecheck + lint + validators +
  OpenSpec strict; canary release-spot (no full matrix rebuild: no
  UI-layout change, but game screens touched → representative native
  completion evidence).

## Runtime/native evidence plan

Game screens change (hook default): exercise representative canary games
across domains on the dedicated AVD (real completion → persisted result,
correct immediate XP, relaunch retention) rather than the full 42-catalog
soak (catalog repeatability was proven in 046 and is re-proven in 067).

## Rollback / risk notes

- Per-game edits are independent; any single game reverts cleanly.
- The main risk is an XP mismatch (optimistic ≠ authoritative) if a screen's
  context difficulty diverges from the record level — mitigated by the
  per-game parity check (packet completion criterion).
- `canonicalNormalizedResult` still rejects garbage at the DB boundary, so
  a missed sanitization surfaces as a loud persist error, never silent
  corruption.

## Completion criteria

Same terminal bar as 056 (spec satisfied, full matrix exact counts,
adversarial review, durable state, pushed, `HEAD == origin/main`, no temp
worktrees) + per-packet parity proof + canary native evidence.
