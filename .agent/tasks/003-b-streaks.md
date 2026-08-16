# Task Packet 003-b — Streaks + Freeze/Recovery Model (WP-3B)

Campaign: 003-platform-integration
Status: DONE
Owner role: coder agent

## Objective

Build the streak model (pure reconstruction) plus Freeze/Shield + Recovery item rules as a self-contained module under `apps/mobile/src/streaks/`. NO new db tables — activity comes from session history (`db.sessions`), and item counts live in profile `settings_json` (merged by `db.profile.update`). The Home streak-slot UI is orchestrator work — NOT yours.

## Dependencies (read-only, all committed)

- `apps/mobile/src/db/index.ts` — `db.sessions.listRecent/listByGame` (completedAt timestamps), `db.profile.get/update` (settings merge semantics: `update({settings})` merges, never replaces wholesale), `db.ledger.append({amount, reason})` + `getBalance()`.
- `apps/mobile/src/db/profile.ts` — exact settings storage contract (read the parse/merge code).

## Required deliverables (all under `apps/mobile/src/streaks/`)

- `types.ts` — `StreakState {current:number, longest:number, lastActiveDate:string|null, atRisk:boolean, frozenDays:number}`, `StreakItemKind` ('freeze' | 'shield' | 'recovery'), `StreakInventory {freeze:number, shield:number, recovery:number}`.
- `reconstruct.ts` — PURE `reconstructStreak(activityDates: readonly string[], today: string): StreakState`:
  - `activityDates` = local `YYYY-MM-DD` strings (may be unsorted, may include duplicates, may include future dates — ignore > today).
  - `current` = length of consecutive days ending today; if no activity today, the streak **breaks** unless a freeze is applied (see below) — reconstruction is pure: it returns raw numbers plus `atRisk:boolean` (true when the last active day is exactly yesterday and no activity today yet).
  - `longest` = max run in the full history (leap-year aware via proper date arithmetic — reuse the pattern from `src/workout/today.ts` `previousDate/nextDate`, or implement your own with `Date.UTC`).
- `inventory.ts` — `readInventory(profileSettings): StreakInventory` (tolerant parse: missing keys → 0), `grantItems(settings, items)` and `consumeItem(settings, kind)` as PURE settings-transform helpers returning the next settings object (the caller persists via `db.profile.update`). Keep the shape namespaced, e.g. `settings.streaks = {freeze: n, shield: n, recovery: n}`.
- `rules.ts` — item cost/limit constants + pure decision logic:
  - `FREEZE_COST_COINS`, `SHIELD_COST_COINS`, `RECOVERY_COST_COINS` (constitution §18: suggest 100/150/200 with a documented rationale comment; the numbers are config constants, easily changed).
  - `FREEZE_MAX_PER_PERIOD` (e.g. 3 per calendar month), `RECOVERY_MAX_STREAK_RESTORE_DAYS` (e.g. 3 days).
  - `canPurchase(balance, kind, settings, now)`, `canApplyFreeze(state, settings, now)`, `applyRecovery(state, maxRestoreDays)` — pure.
- `index.ts` — barrel with named exports.
- `__tests__/` — reconstruction (empty history, single day, long run, mid-streak gap breaks, future dates ignored, unsorted/duplicates, leap-year Feb 29 boundary, atRisk flag), inventory parse/merge/consume, rules decisions (insufficient balance, limits, recovery caps).

## Conventions

- Pure functions everywhere except a thin optional `repository.ts`-style helper is FORBIDDEN — callers (orchestrator UI wiring) do db calls. Keep everything db-free; tests need no sqlite.
- TypeScript strict; deterministic tests with fixed dates; preserve useful comments; no new dependencies.

## Allowed write surfaces

- `apps/mobile/src/streaks/**`

## Forbidden / shared write surfaces

- `apps/mobile/src/db/**`, `src/sdk/**`, `src/app/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, `src/registry/**`, `src/workout/**`, `src/quests/**`, `src/content/**`, `package.json`, root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- All own tests pass (`npx jest src/streaks` from `apps/mobile`).
- `npx tsc --noEmit` (from `apps/mobile`) — fix only errors in your ownership surface.
- No db writes anywhere in your module (settings transforms return plain objects).

## Cheap validation

- `npx jest src/streaks` and `npx tsc --noEmit` (both from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator wires the Home streak slot: reads `reconstructStreak` from session dates + profile inventory, and handles purchase/apply persistence. Your module must expose pure logic only.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
