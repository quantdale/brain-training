# Spec — result-reward-correctness

## ADDED Requirements

### Requirement: Normalizers never throw on corrupt stats (session survival)

Every game's `normalize*Result` SHALL NOT throw on non-finite statistical
inputs: count/accuracy corruption degrades to worst-case (`value: 0`);
speed-only corruption degrades that term to 0 while accuracy-driven terms
keep their value (partial worst-case, e.g. all-correct + NaN speed yields
the accuracy-only value — never a throw, never a lost session).
Aggregation helpers SHALL be stack-safe on hostile-length arrays
(iterative min with exact `Math.min` parity, including NaN poisoning).
Helpers that explicitly validate configuration params with
`Number.isFinite` (e.g. tap-rush/vigilance/order-sweep/number-line window
and budget guards) SHALL keep throwing `RangeError`; games without such
param guards never had them and gain none.

#### Scenario: NaN count stat degrades to zero, session survives

- GIVEN a raw result with a NaN count/accuracy stat (e.g.
  `speedFactors: [NaN]` with zero hits, `roundsCorrect: NaN`)
- WHEN the game's normalizer runs
- THEN it returns `{ value: 0, scale: '0..1' }` without throwing, so
  finalization proceeds to `buildSessionRecord` + persist with
  participation XP.

#### Scenario: Speed-only corruption degrades partially, never throws

- GIVEN all-correct results with a NaN speed stat
- WHEN the normalizer runs
- THEN it returns the accuracy-only value (e.g. `0.6` for the 0.6/0.4
  blends) without throwing.

#### Scenario: Explicit param validation still throws

- GIVEN a non-finite configuration param passed to a helper that
  explicitly guards with `Number.isFinite` (e.g. tap-rush `windowMs`)
- WHEN the scoring helper validates it
- THEN it throws `RangeError` as before.

### Requirement: Optimistic XP equals authoritative XP by construction

All 42 game screens SHALL default to a shared pipeline-backed XP hook whose
`computeXp` is exactly the rating pipeline's `computeXp` applied to the
normalized value and the record's difficulty level. The first rendered
reward SHALL already equal the later authoritative outcome; the DB outcome
confirms rather than corrects.

#### Scenario: Immediate reward correctness

- GIVEN a completed session with normalized value `v` at level `L`
- WHEN the in-game result renders before the persist round-trip
- THEN the shown XP equals `computeXp(v, L)` — the same value
  `completeSession` will persist as `storedXp`.

#### Scenario: Parity condition per game

- GIVEN any game's finalization flow
- WHEN it computes optimistic XP
- THEN the difficulty passed to the hook equals the persisted record's
  `difficulty.level` (verified per game; fixed to the profile level where
  divergent).

### Requirement: Personal-best shares the recent list's time universe

`loadPersonalBest` SHALL clamp its comparison upper bound to
`min(session.completedAt, Date.now())`, so clock-skewed future-dated
sessions are judged in the same universe the recent list displays.

#### Scenario: Future-dated session judged like displayed history

- GIVEN a session with `completedAt` in the future and weaker performance
  than a genuinely earlier best
- WHEN Results evaluates PB
- THEN the earlier best still wins (the future row cannot claim PB by
  comparing against an inflated universe).

## MODIFIED Requirements

### Requirement: Game `clamp01` semantics (data positions collapse)

The 42 per-game `clamp01` copies SHALL collapse non-finite input to `0`
(the pipeline's documented safe failure mode) instead of throwing. Tests
pinning the throw for data inputs MUST be updated; the pipeline's own
collapsing `clamp01` is the semantic authority.

#### Scenario: Collapse, not throw

- GIVEN `clamp01(NaN)` in any game's scoring module
- WHEN evaluated
- THEN the result is `0` (no throw).

#### Scenario: Builder aggregation is stack-safe

- GIVEN a hostile-length stats array (1M entries)
- WHEN `bestOf` runs (raw-builder path in the four speed games, plus one
  render site)
- THEN it returns the minimum without throwing, with `Math.min` parity
  (empty → null, NaN anywhere → NaN).

## REMOVED Requirements

None.
