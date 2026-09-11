# Design — Campaign 025: Game Board Feedback Consistency

## Invariants

- `docs/PROJECT_CONSTITUTION.md` locked decisions stand; gameplay, scoring,
  generators, difficulty and persistence are untouched.
- The verdict vocabulary already proven in Campaign 024's canaries is the target
  language; this campaign propagates it rather than inventing a new one:
  - fill: `successSoft`/`dangerSoft` (or `warningSoft` for a timeout),
  - boundary: `success`/`danger` border at verdict,
  - glyph: ✓ / ✕ / ⏱ badge, marked decorative for assistive tech,
  - label: the verdict is in the accessible name ("Correct", "Wrong pick",
    "Timed out"), never colour-only,
  - the prompt/stem stays mounted while feedback shows.
- Feedback is derived from the reducer's resolved outcome. A tap that arrives
  after the deadline must not present success.
- All audio/haptics continue through `liveAudioHaptics` (no direct expo-haptics),
  so the global sensory settings and reduced motion keep working.
- Every interactive board cell presents ≥44×44 dp through size or `hitSlop`;
  `hitSlop` must not be used where adjacent cells would overlap.
- Scoring numbers animate with `AnimatedNumber` (tabular figures) so a score
  change reads as movement without reflowing layout.

## Why per-game work is required

The eight canaries covered eight different mechanics (recall grid, tap field,
option list, number pad, card sort, pattern match, symbol cell, equation build).
The 31 remaining games reuse those mechanic *families*, so each game's packet is
a mapping exercise: find the answer surface, map its verdict states onto the
shared vocabulary, and delete the local styling it replaces. Where a game's
mechanic makes a rule inapplicable (e.g. a speed round with no per-item verdict,
or a board whose cells are not interactive), the packet records that instead of
forcing a change.

## HUD round progress

`GameHost` already accepts `roundProgress={{ value, total }}` and renders a
segmented `ProgressBar` in the HUD centre. Games that track rounds
(`roundIndex`/`totalRounds`, `trialIndex`/`totalTrials`, …) pass it; games whose
session is open-ended (endless or time-boxed) do not, and keep the round chip.

## Verification strategy

| Claim | Evidence |
|---|---|
| Verdict language applied | per-packet summary of the mapping + focused behavioural tests |
| No mechanics drift | game unit suites unchanged and green; scoring files untouched in the diff |
| Runtime intact | autobot canaries; representative board screenshots before/after |
| Consistency | the eight canaries are the reference; a reviewer can compare any two boards |
