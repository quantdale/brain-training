## Context

027 R3: `speed-color-match` persists `fastestReactionMs: number | null`. Color Stroop still does Infinity → 0. Analytics `REACTION_BEST_FIELDS` includes `fastestResponseMs`. Other games use -1/0 sentinels for missing bests.

## Goals / Non-Goals

**Goals:** absent samples are `null` in JSON and skipped by aggregators.

**Non-Goals:** rating/XP (they use `normalizedResult`); rewriting historical rows in SQLite (read-path compatibility only).

## Decisions

1. **Color Stroop first** (analytics-visible). `fastestResponseMs: number | null`; Infinity → `null`.
2. **Siblings in the same PR:** `bestRoundTimeMs` / `bestSolveGuesses` on the four listed games → `null`.
3. **Analytics:** `readNumber` treats `null` as absent; optionally treat `<= 0` for `fastestResponseMs` as absent for historical Color Stroop zeros (document the compatibility rule so a real 0 ms expert tap is not dropped if that is possible — reaction 0 ms is not realistic, so `<= 0` skip is acceptable for best-reaction fields only).
4. **Do not change in-reducer running minima** until persist; only the persistence mapping and types.

## Risks / Trade-offs

- Tests that `expect(raw.fastestResponseMs).toBe(0)` must flip to `null`.
- Import of old backups with 0 still needs the analytics compatibility skip.

## Testing strategy

- Session builder tests for each listed game.
- Analytics extract fixture with `fastestResponseMs: null` and `0`.
- Existing speed-color-match tests stay green (template).
