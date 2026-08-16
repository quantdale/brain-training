# Task Packet 003-a — Quests Engine (WP-3A)

Campaign: 003-platform-integration
Status: DONE
Owner role: coder agent

## Objective

Build the quests/achievements **engine** (data model + pure evaluation + reward application) as a self-contained module under `apps/mobile/src/quests/`. The db tables (`quests`, `quest_progress`, `achievements`, `achievement_unlocks`) and repositories (`db.quests`, `db.achievements`, `db.xpAwards`) already exist (schema v3, merged on `main`). The app wiring (definition seeding at startup, UI) is the orchestrator's job — NOT yours.

## Dependencies (read-only, all committed)

- `apps/mobile/src/db/index.ts` — `AppDatabase` facade with `sessions`, `ledger`, `ratings`, `profile`, `quests`, `achievements`, `xpAwards` repos. Read `src/db/quests.ts`, `src/db/achievements.ts`, `src/db/xp-awards.ts` for exact repo signatures (upsertDefinition / listDefinitions / recordProgress / listProgressForPeriod / claim; unlock / getUnlock / listUnlocks; award / getTotalAwardedXp).
- `apps/mobile/src/sdk/**` — for any shared types (e.g. category strings; `GAME_CATEGORIES`).
- `apps/mobile/src/games/*/game.json` — the eight game ids/primaryCategory values you may reference in criteria.

## Required deliverables (all under `apps/mobile/src/quests/`)

- `types.ts` — `QuestId`, `QuestKind` ('daily' | 'weekly' | 'longterm'), `QuestCriteria` (discriminated union: `{type:'session-count', goal:number}` | `{type:'domain-sessions', domain:string, goal:number}` | `{type:'earn-xp', goal:number}`), `QuestReward {xp:number, coins:number}`, `QuestDefinition {id, kind, title, description, criteria, reward, version}`, `QuestEvaluation {questId, periodKey, progress, goal, completed}`.
- `definitions.ts` — versioned definition list `QUEST_DEFINITIONS_V1` (const array; include `version: 1` on each) covering, at minimum: a daily session-count quest (3 sessions), a daily earn-xp quest, a weekly domain-sessions quest (e.g. 10 sessions in one domain), and one longterm achievement-style quest (e.g. 100 lifetime sessions). Rewards in xp + coins (small: daily ~15–25 xp / 5–10 coins; weekly ~60–100 xp / 20–40 coins). Keep IDs stable (`quest:play-3-sessions` style: `qd3`, `qdx`, `qw-<domain>`, `qt100`).
- `period.ts` — period-key helpers: `periodKeyFor(kind, dateStr)` — daily = `YYYY-MM-DD`, weekly = `YYYY-Www` (ISO week, e.g. `2026-W33`), longterm = `'all'`. `currentPeriodKey(kind, now)`.
- `evaluate.ts` — PURE function `evaluateQuests(definitions, snapshot, now)` where `snapshot: {sessions: readonly {completedAt:number, gameId:string, domain:string, xp:number}[]}`. Returns per-quest `QuestEvaluation` for the current period (weekly counts only sessions in the current ISO week; daily only today — local calendar dates derived from timestamps with an injectable `now`). NO db access.
- `rewards.ts` — `applyQuestReward(db, definition, periodKey)` which atomically: `recordProgress` (set to completed state via the repo contract), `claim`, `db.xpAwards.award` with source `quest:<id>` and reason `'quest'`, and `db.ledger.append({amount: reward.coins, reason: 'quest'})`. Must be idempotent-safe (claim once-only is enforced by the repo — call and report repo behavior; if the repo throws on double-claim, let the error propagate as a typed error). Handle the case where the definition's progress is not yet complete (refuse to reward).
- `index.ts` — barrel: default export not required; named exports of all public logic.
- `__tests__/` — period-key math (incl. ISO week boundary, year boundary), evaluator (day/week filtering, goal reached, no sessions → 0), rewards with a stubbed/in-memory db (see existing `src/db/__tests__/` for the in-memory adapter pattern — reuse it via imports from the test helpers if any exist; otherwise construct `AppDatabase` with the memory adapter used in db tests).

## Conventions

- Pure logic first; db only in `rewards.ts`. TypeScript strict. Deterministic tests with fixed dates.
- Do NOT edit db schema, migrations, or any repo file. `db.quests.recordProgress` is monotonic-MAX by contract — design `evaluate` to report progress counts, and let the orchestrator's startup/UI wiring decide when to persist.
- No new dependencies. Import only `@/db`, `@/sdk` (if needed), react-free modules, and your own module.

## Allowed write surfaces

- `apps/mobile/src/quests/**`

## Forbidden / shared write surfaces

- `apps/mobile/src/db/**`, `src/sdk/**`, `src/app/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, `src/registry/**`, `src/workout/**`, `src/streaks/**`, `src/content/**`, `package.json`, root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- All own tests pass (`npx jest src/quests` from `apps/mobile`).
- `npx tsc --noEmit` (from `apps/mobile`) — fix only errors in your ownership surface.
- Evaluator is pure and deterministic; rewards path is safe against double-claim.

## Cheap validation

- `npx jest src/quests` and `npx tsc --noEmit` (both from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator seeds `QUEST_DEFINITIONS_V1` into the db at startup and wires the quests UI + reward claiming. Your module must expose everything needed without touching `app/`.
- Your definition IDs are the canonical keys; do not reuse across kinds.

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
