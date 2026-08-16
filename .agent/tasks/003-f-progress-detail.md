# Task Packet 003-f — Progress Detail Screen (WP-3F)

Campaign: 003-platform-integration
Status: ACTIVE
Owner role: coder agent
NOTE: You are the ONLY agent allowed to write in `apps/mobile/src/app/**` this wave.

## Objective

Build a deeper Progress dashboard one tap away from the existing Progress tab (constitution §21): per-game record lists, per-domain rating history, and recent sessions. New route `app/progress-detail.tsx` + a link/entry point added to `app/(tabs)/progress.tsx`.

## Dependencies (read-only)

- `apps/mobile/src/app/(tabs)/progress.tsx` — existing screen; mirrors its data-loading pattern (`useFocusEffect` + `useDbData` + `loadProgress`), components, and styling conventions. Its `progress-summary` testID contract must keep passing (see `src/app/__tests__/`).
- `apps/mobile/src/db/index.ts` — `db.sessions.getGameAggregate(gameId)`, `listByGame(gameId)`, `listRecent(n)`, `getTotalXp()`; `db.ratings.getHistory(limit)` returning `RatingHistoryEntry[]` (read `src/db/rating.ts` for the exact shape — it likely includes domain, rating, delta, sessionId, createdAt).
- `apps/mobile/src/components/**` — `ScreenShell`, `ThemedText`, `ThemedView`, and any card/button components already used by progress.tsx.
- `apps/mobile/src/registry/registry.ts` — `getGameDefinition(gameId)`; `apps/mobile/src/rating/` — level helpers (`levelForXp`, etc.) if useful.
- `apps/mobile/src/constants/theme` — spacing/radii tokens.

## Required deliverables

- `apps/mobile/src/app/progress-detail.tsx` — Expo Router route (default export screen). Contents:
  - Per-domain history section: for each domain with history, the last N entries (e.g. 20) as a mini-trend (rating values + deltas + dates; plain list is fine — no charts required).
  - Per-game records section: for each game (from aggregates), best normalized score, session count, last played; a compact per-game list that links to the existing game detail route (`/game-detail` — check its route params in `src/app/game-detail/` and reuse the same Link pattern progress.tsx uses).
  - Recent sessions section reusing the existing recent-sessions rendering approach from progress.tsx (link to `/results`).
  - Empty-state handling when db has no data (do not crash; show explanatory text).
  - Stable semantic testIDs prefixed `progress-detail-*` on every interactive/structural element.
- Edit `apps/mobile/src/app/(tabs)/progress.tsx` — add a clearly labeled entry (e.g. "Full history" row/button with testID `progress-detail-link`) linking to `/progress-detail`. Do NOT change any existing testID or behavior.
- `apps/mobile/src/app/__tests__/progress-detail.test.tsx` — jest-expo screen smoke test mirroring the existing app tests (see how `src/app/__tests__/` renders screens with the db stubbed; reuse that harness): renders with empty data, renders with fabricated data (a few domains, aggregates, sessions), link navigates (or at least renders the Link target), `progress-detail-*` testIDs present.

## Conventions

- Follow the existing app-screen code style (function components, `ScreenShell`, Themed* primitives, `useDbData`/`useFocusEffect` data pattern).
- TypeScript strict; deterministic tests; no new dependencies.

## Allowed write surfaces

- `apps/mobile/src/app/progress-detail.tsx` (new)
- `apps/mobile/src/app/(tabs)/progress.tsx` (additive edit only)
- `apps/mobile/src/app/__tests__/progress-detail.test.tsx` (new)

## Forbidden / shared write surfaces

- Everything else: `src/db/**`, `src/sdk/**`, `src/components/**`, `src/theme/**`, `src/constants/**`, `src/registry/**`, `src/workout/**`, `src/quests/**`, `src/streaks/**`, `src/content/**`, `src/games/**`, `package.json`, root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- `npx jest src/app` passes from `apps/mobile` (your new test + all existing app tests unchanged and green).
- `npx tsc --noEmit` from `apps/mobile` — fix only errors in your ownership surface.
- If the typed-routes file `apps/mobile/.expo/types/router.d.ts` is stale and rejects the new route, DELETE the stale generated file (regenerated on next start) — do not hand-edit it.

## Cheap validation

- `npx jest src/app` and `npx tsc --noEmit` (both from `apps/mobile`).

## Integration notes for orchestrator

- Orchestrator runs the full suite after merge; the new route is registered automatically by expo-router (file-based).

## Result/evidence

(agent fills in: files created, test counts/results, deviations, anything the orchestrator must converge)
