# Task Packet 003-d — Offline/Network Boundary Tests (WP-3D)

Campaign: 003-platform-integration
Status: ACTIVE
Owner role: coder agent

## Objective

Prove the core offline-first flows never touch the network (constitution §5) with (a) a jest suite that monkeypatches `global.fetch` and `XMLHttpRequest` to throw on any use, and (b) a static validator script that scans `apps/mobile/src` for network APIs outside an explicit allowlist. If the scan finds violations in core flows, report them — do NOT fix code outside your write surface.

## Dependencies (read-only)

- `apps/mobile/src/db/__tests__/` — find the in-memory/mock adapter used by db tests (e.g. how `migrations.test.ts` / `quests.test.ts` construct `AppDatabase`); reuse that construction pattern so your suite does not need real sqlite.
- `apps/mobile/src/workout/today.ts` — `dailyWorkout` (pure selection; no db) — workout selection must be exercised offline.
- `apps/mobile/src/db/sessions.ts` — `completeSession` signature (read how the rating pipeline runs inside it).
- `apps/mobile/src/rating/` — rating pipeline entry points.
- `apps/mobile/src/quests/**`, `apps/mobile/src/streaks/**`, `apps/mobile/src/content/**` — will exist after sibling packets land; your test may import only what already exists on `main` PLUS what is present at run time (siblings are merged before the convergence run; write your suite to test the core flows that exist NOW: db init-equivalent, completeSession, rating, workout selection, quest/streak/content if present — guard imports so a missing sibling does not break your suite? NO — siblings will land before you are merged; test the current core set and leave a documented TODO entry for extending to quests/streaks if they are absent when you write it).

## Required deliverables

- `apps/mobile/src/__tests__/offline-boundary.test.ts` — jest suite that:
  1. Monkeypatches `global.fetch` and `global.XMLHttpRequest` (and `global.WebSocket` if trivially present) to throw `new Error('OFFLINE TEST: network access attempted')`.
  2. Asserts: (a) constructing `AppDatabase` with the in-memory adapter + running `runMigrations` + profile `ensureExists` performs no network access; (b) `completeSession` on the in-memory db (use the same fixture shape as `src/db/__tests__/sessions.test.ts`) performs no network access; (c) rating pipeline (`applyDeltas` or the rating service used by completeSession) performs none; (d) `dailyWorkout`/`pickWorkoutGames` with the real registry definitions performs none; (e) quest evaluation + streak reconstruction (if present at write time) perform none.
  3. Also statically greps (in-test, via `fs` + path walk or a fixed list) the modules under `src/games`, `src/workout`, `src/rating`, `src/sdk`, `src/db` for `fetch(`, `XMLHttpRequest`, `axios` and fails the test listing offenders (allowlist may be empty; if a legit allowlisted exception exists, document it in the test with a comment and a named allowlist array).
- `scripts/validate-offline.mjs` — node script (no deps, uses `node:fs`/`node:path`): scans `apps/mobile/src` recursively for `fetch(`, `XMLHttpRequest`, `axios`, `WebSocket(` occurrences; excludes `__tests__`/`__mocks__`/`*.test.ts`/`*.spec.ts` and any explicitly documented allowlist; prints a table of hits with file:line and exits 0 (clean) or 1 (violations). Deterministic output; run from repo root as `node scripts/validate-offline.mjs`.

## Conventions

- The scan must not false-positive on `fetch(` inside comments — use a light regex that ignores lines containing `//` or `*` comment markers, and note the limitation in the script header.
- TypeScript strict for the test; the script is plain ESM `.mjs`.

## Allowed write surfaces

- `apps/mobile/src/__tests__/offline-boundary.test.ts`
- `scripts/validate-offline.mjs` (exception to the shared-surface rule — you own this one script ONLY; no other root files)

## Forbidden / shared write surfaces

- Everything else under `apps/mobile/src/**`, `package.json`, other root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- `npx jest src/__tests__/offline-boundary` passes from `apps/mobile`.
- `node scripts/validate-offline.mjs` runs from repo root; exit 0 or a documented, actionable violation list with file:line.
- `npx tsc --noEmit` from `apps/mobile` clean (fix only your file).

## Cheap validation

- `npx jest src/__tests__/offline-boundary` (from `apps/mobile`); `node scripts/validate-offline.mjs` (from repo root).

## Integration notes for orchestrator

- Orchestrator runs `validate-offline.mjs` in the light-validation wave and records results in `.agent/VALIDATION.md`. Any violations in core flows are Critical-class (offline-first violation) — report them prominently.

## Result/evidence

(agent fills in: files created, test counts/results, scan output, deviations)
