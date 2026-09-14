## ADDED Requirements

### Requirement: Color Stroop missing fastest sample is null
When Color Stroop has no finite fastest response (internal Infinity sentinel), the persisted `fastestResponseMs` MUST be JSON `null`, not `0`.

#### Scenario: No valid reaction
- GIVEN a Color Stroop completion with `fastestResponseMs === Infinity`
- WHEN the raw result is built
- THEN `fastestResponseMs` is `null` and JSON.stringify emits `null`

### Requirement: Analytics ignore null fastest fields
Reaction-best aggregation MUST skip `null` (and MUST NOT treat `0` from historical Color Stroop rows as a 0 ms record if a compatibility filter is chosen). New rows with `null` MUST NOT create a 0 ms personal best.

#### Scenario: Null is not a best
- GIVEN a session whose only reaction-best field is `fastestResponseMs: null`
- WHEN Progress reaction extracts run
- THEN no 0 ms sample is recorded from that field

### Requirement: Remaining Infinity sentinels persist as null
Games that still map missing best-time/best-guess to `-1` or `0` (`attention-target-count` `bestRoundTimeMs`, `logic-rule-grid` `bestRoundTimeMs`, `logic-code-cracker` `bestSolveGuesses`, `logic-order-path` `bestRoundTimeMs`) MUST persist `null` when no sample exists, with types `number | null`.

#### Scenario: Rule grid no best round
- GIVEN a logic-rule-grid session with no finite best round time
- WHEN the raw result is built
- THEN `bestRoundTimeMs` is `null`, not `-1` or `0`
