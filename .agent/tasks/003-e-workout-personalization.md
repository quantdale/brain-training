# Task Packet 003-e — Workout Personalization (WP-3E)

Campaign: 003-platform-integration
Status: DONE
Owner role: coder agent

## Objective

Extend Today's Workout with personalization inputs + reroll economics as PURE functions in `apps/mobile/src/workout/`. The existing `today.ts` (deterministic `dailyWorkout`, chain-based soft avoidance) stays the deterministic core; you add balancing/recency/reroll layers on top WITHOUT breaking its public API or its tests. Home-screen CTA wiring (calling these functions with real db data) is orchestrator work — NOT yours.

## Dependencies (read-only)

- `apps/mobile/src/workout/today.ts` — keep `WORKOUT_SIZE`, `MAX_OVERLAP_WITH_YESTERDAY`, `pickWorkoutGames`, `dailyWorkout`, `localDateString` signatures intact (their tests must keep passing unchanged).
- `apps/mobile/src/db/rating.ts` — `DomainRating {domain, rating, lastUpdatedAt, ...}`; `INITIAL_RATING`/`MIN_RATING` (1000/100 or whatever is exported — read it).
- `apps/mobile/src/sdk/**` — `GameDefinition` (has `primaryCategory`), `createRng` for deterministic shuffles.
- `apps/mobile/src/registry/registry.ts` — `getGameDefinition`.

## Required deliverables (under `apps/mobile/src/workout/`)

- `personalize.ts`:
  - `reorderByWeakDomains(games, domainRatings, rng)` — pure; deterministically favors games whose `primaryCategory` domain rating is below a documented threshold (e.g. `< 1000`, the initial rating — read `INITIAL_RATING` and use it), stable for equal ratings; returns a reordered copy. Domain-to-category matching: compare `game.primaryCategory` against `DomainRating.domain` (verify the exact strings used by the rating engine in `src/db/rating.ts` / `src/rating/` — match exactly).
  - `rankByRecency(games, recentGameIds)` — pure; deprioritizes games appearing in `recentGameIds` (most-recent-last order stable), keeps determinism when combined with a seeded rng.
  - `personalizedWorkout(games, date, domainRatings, recentGameIds, attempt=0)` — composition: `dailyWorkout` → recency reorder → weak-domain reorder, all with seeded rng derived from `workout::<date>::<attempt>::personalized` (document the seed scheme). Pure; no db.
- `reroll.ts`:
  - Constants: `REROLL_FIRST_FREE = true`, `REROLL_COST_COINS = 25` (documented; constitution §14 reroll economics — cost applies from the 2nd reroll per day), `MAX_REROLLS_PER_DAY = 5`.
  - `rerollCost(attemptsUsed)` — pure: 0 when `attemptsUsed === 0` and first-free, else `REROLL_COST_COINS × attemptsUsed` (escalating is fine; document).
  - `canAffordReroll(balance, attemptsUsed)` and `nextWorkoutAfterReroll(games, date, domainRatings, recentGameIds, attemptsUsed)` — pure; returns the new selection for `attempt = attemptsUsed` (attemptsUsed+1 seeded variant). Callers (orchestrator) handle the ledger debit.
- `__tests__/` — reordering determinism (same seed → same order), weak-domain priority with fabricated DomainRatings, recency deprioritization, composition stability across dates, reroll economics (first free, escalating costs, unaffordable → declined), existing `today.test.ts` untouched and green.

## Conventions

- All new functions pure; zero db imports. TypeScript strict; deterministic tests with fixed seeds and fabricated data.
- Do not change existing exports or behavior of `today.ts` (you may ADD exports to it only if needed and non-breaking).

## Allowed write surfaces

- `apps/mobile/src/workout/**` (new files + `today.ts` additive-only edits)

## Forbidden / shared write surfaces

- `apps/mobile/src/db/**`, `src/sdk/**`, `src/app/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, `src/registry/**`, `src/quests/**`, `src/streaks/**`, `src/content/**`, `package.json`, root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- All own tests pass (`npx jest src/workout` from `apps/mobile`).
- `npx tsc --noEmit` from `apps/mobile` — fix only errors in your ownership surface.
- Existing `today.test.ts` (or equivalent) passes UNCHANGED.

## Cheap validation

- `npx jest src/workout` and `npx tsc --noEmit` (both from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator wires Home CTA: loads domain ratings + recent sessions from db, calls `personalizedWorkout`/reroll helpers, debits ledger on paid rerolls, updates the workout list UI.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
