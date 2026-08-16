# Task Packet 002-h — Shared Platform (WP-2H)

Campaign: 002-eight-representative-games
Status: ACTIVE
Owner role: orchestrator (shared surfaces; not delegated to parallel coders)

## Objective

Implement the shared platform surfaces that make the eight games a real product (constitution §15–§18, §21; campaign WP-2H):

1. **Scoring/ratings engine** — real `XpRatingHook` semantics: normalized performance → expected-difficulty comparison → per-domain rating update + overall composite (constitution §15 pipeline). Hybrid lifetime/recent behavior, gradual movement, no inactivity decay (stale marking instead).
2. **XP/player level** — global level from cumulative XP with smoothly growing requirements; poor attempts still earn some XP, better play earns bonuses (constitution §17).
3. **Currency** — normal gameplay earns currency via the append-only ledger (constitution §17); ledger UI (balance + transaction history).
4. **Results screens** — post-session summary: score, accuracy, reaction, difficulty, rating movement, XP, records (constitution §16).
5. **Game detail screens** — per-game info: description, difficulty select, records, recent history, tutorial replay entry.
6. **Favorites/search/filter basics** — favorites persistence + Games library search/filter.
7. **Basic Progress analytics** — overall/domain histories, per-game analytics, activity frequency (constitution §21), one tap from the Progress tab.

## Architecture direction (validated against existing code)

- **DB migration v2** (`src/db/schema.ts`, `SCHEMA_VERSION` → 2): append-only `rating_history` (session_id, domain, delta, rating_after, created_at) with no-update/no-delete triggers like `currency_ledger`; `domain_ratings` (domain PK, rating, sessions, updated_at); `game_favorites` (game_id PK, created_at). Do not alter existing tables/columns; existing rows stay valid.
- **Rating service seam** in the db layer: `AppDatabaseOptions` gains an optional rating service consumed by `SessionRepository.completeSession` (single write path; session row + rating history + domain ratings + currency + profile touch all in the existing transaction). Games are NOT changed — the orchestrator wires the real service in `src/app/_layout.tsx` (or wherever `initDatabase` is called) after this packet.
- **Engine module** `src/rating/` (orchestrator-owned): XP curve, level curve, per-domain rating update (documented formula: e.g. expected-performance-per-difficulty baseline, gradual k-factor, cap per session), currency award rule, staleness marking (read-side). Pure functions, fully unit-tested with fixed inputs; no timing dependence (inject clock).
- **UI** in `src/app/` + `src/components/` + `src/registry`-adjacent helpers as needed: results route (linked from each game's completion), game detail route (linked from Games library), favorites toggle (persisted), search/filter on the Games tab, Progress tab analytics (recent sessions, per-game aggregates, domain ratings, XP/level, currency). Follow existing screen-shell/themed component conventions.
- Keep the design system coherent: reuse `@/theme` tokens and `ScreenShell`; add shared components only under `src/components/`.

## Write surfaces (orchestrator only)

- `apps/mobile/src/db/**` (schema v2 + rating tables + favorites + service seam)
- `apps/mobile/src/rating/**` (new engine module)
- `apps/mobile/src/app/**` (routes: results, game detail; Games/Progress/Home updates)
- `apps/mobile/src/components/**` (shared UI)
- `apps/mobile/src/registry/**` (only if a consumer mapping is required)
- `scripts/**`, `.agent/**`, `docs/**` as needed for convergence/state

## Completion criteria

- Migration v2 tests (up from v1 with existing rows preserved; down not required but document rollback stance), rating/XP/currency pure-function tests, favorites persistence tests.
- Existing game modules (memory) still pass; completeSession path still atomic; existing session rows interpretable (constitution §21: no silent reinterpretation).
- Games library shows search/filter/favorites; game detail + results reachable; Progress tab shows analytics.
- Typecheck + jest + web export + registry `--check` all green.

## Cheap validation

- `npx tsc --noEmit`, `npx jest` (whole tree), `node scripts/generate-game-registry.mjs --check`, `npx expo export --platform web`.

## Integration notes

- This packet runs after (or in parallel with, never racing) the game packets; the games' session.ts must NOT need changes — verify that invariant.
- Rating engine numbers (k-factor, XP curve, currency rule) must be documented in the module + ADR if consequential.

## Result/evidence

(orchestrator fills in)
