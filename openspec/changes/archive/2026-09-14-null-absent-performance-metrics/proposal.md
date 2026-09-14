# Proposal — Null absent performance metrics

## Why

Campaign 027 converted `speed-color-match` `fastestReactionMs` from `Infinity` to `null` so JSON and analytics do not treat a missing best as a real 0 ms sample. `flexibility-color-stroop` still maps `fastestResponseMs === Infinity` to **0** (`session.ts`). `analytics/metrics-map.ts` `REACTION_BEST_FIELDS` includes `fastestResponseMs`; `readNumber` only rejects non-finite values, so 0 is a legitimate fastest time. Other games persist absence as `-1` or `0` (`attention-target-count`, `logic-rule-grid`, `logic-code-cracker`, `logic-order-path`).

## What Changes

- Absent "best/fastest" metrics MUST persist as JSON `null` (typed `number | null`), never `Infinity`, `-1`, or a sentinel `0`, when the field is consumed as a duration or count of a real attempt.
- Analytics extractors MUST ignore `null` (already ignore non-finite; they MUST also ignore the old sentinels during a compatibility window if historical rows exist).
- Tests MUST pin Color Stroop (and listed siblings) the way `speed-color-match` is pinned.

## Capabilities

### New Capabilities

- `absent-metric-nulls`: missing best/fastest performance fields persist and aggregate as null, not as 0 or -1.

### Modified Capabilities

- (none in main `openspec/specs/`; completes 027 R3 for remaining siblings)

## Impact

- `apps/mobile/src/games/flexibility-color-stroop/session.ts` (+ types)
- Sibling session builders listed in evidence
- `apps/mobile/src/analytics/metrics-map.ts`
- Existing session tests that currently expect `0` / `-1`

## Out of scope

- Reinterpreting historical session rows' meaning for ratings/XP (ratings already used normalized performance)
- Changing scoring formulas
- `attention-visual-search` in-reducer `fastestResponseMs: 0` **initial state** unless that 0 is also persisted as "no sample"

## Evidence

- Color Stroop `buildColorStroopRawResult`: Infinity → 0
- `metrics-map.ts` `REACTION_BEST_FIELDS` includes `fastestResponseMs`
- 027 `speed-color-match` `fastestReactionMs: number | null` + session test
- Catalog audit table for `-1`/`0` sentinels

## Dependencies

None. Does not block other proposals.

## Intended outcome

A Color Stroop session with no valid reaction sample does not appear as a 0 ms personal best in Progress analytics.
