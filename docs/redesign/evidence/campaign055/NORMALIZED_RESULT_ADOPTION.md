# Campaign 055 (resumed) — Normalized Result / Performance-Band Adoption

Display-only adoption of the shared honest performance band in the in-session
`GameResults` chrome for the 42-game catalog. No scoring, normalization,
persistence, rating, XP, reward, mechanic or session-identity change.

## Method

`GameResults` already accepts an optional `normalizedResult` prop
(`apps/mobile/src/components/game-host/results.tsx`); when provided it derives
the shared band headline and gates celebration honestly. The first Campaign 055
session shipped the prop but no game passed it.

The resumption checked, for all 42 registered games, whether an existing
canonical normalized result was already available at results time — the allowed
source order in the resumption contract is (1) an existing canonical normalized
game result, (2) an explicit existing percentage/accuracy, (3) an authoritative
score/max-score contract. No formula was invented and no raw score was
converted heuristically.

**Result: every game already owns a canonical normalized result.**
Each game's reducer receives `session-finalized` with `normalized` — the
`NormalizedPerformance.value` produced by that game's own SDK
`PerformanceNormalizer` and persisted as `GameSessionRecord.normalizedResult`.
The value was already used by the rating/analytics pipeline; this campaign only
routes it to the results chrome.

Verification per game (all 42): screen dispatches `normalized: normalized.value`
from the SDK pipeline, reducer stores `normalized: action.normalized`, state
type declares `normalized: number | null`.

## Change

`normalizedResult={state.normalized ?? undefined}` was added to the
`<GameResults>` element in all **42/42** game screens. Before the results effect
finishes the band falls back to the existing `title ?? 'Session complete'`, so
there is no new loading-state copy.

Two games keep a factual game-specific title for their exceptional outcome and
fall through to the band on a normal completion:

- `memory-sequence-memory`: `title={state.timeUp ? "Time's up!" : undefined}`
- `speed-reaction-time`:
  `title={state.stats.falseStartAborted ? 'Session ended early' : undefined}`

## Adoption summary

| Class | Count |
| --- | --- |
| Total registered games | **42** |
| Adopters (canonical normalized result existed) | **42** |
| Legitimate non-adopters | **0** |

There are no non-adopters to explain: the canonical normalized value is a
mandatory part of every game's SDK session pipeline, so no game needed invented
semantics and no game needed to fall back to a factual-only title.

## Honest-performance behaviour (shared logic)

Band mapping (`components/shell/format.ts`):

| Normalized | Headline | Celebration |
| --- | --- | --- |
| ≥ 0.90 | Outstanding | confetti + success feedback |
| ≥ 0.75 | Strong run | confetti + success feedback |
| ≥ 0.50 | Solid work | neutral reward row, no confetti |
| ≥ 0.25 | Keep going | neutral reward row, no confetti |
| < 0.25 | Keep training | neutral reward row, no confetti |
| unknown | Session complete | no confetti |

- Weak results never borrow success colour, copy or confetti; the reward card is
  `neutral` and the feedback event is a plain tap instead of the reward sting.
- The reward row states the authoritative XP/coins factually ("Reward +10 XP ·
  +2 coins" / "Progress saved") and only appears after the session persisted.
- "New personal best" is a route-Results badge gated to
  `normalizedResult >= 0.5` (`app/results.tsx`); in-session results never show a
  PB badge, so a weak first session cannot receive a false PB celebration.
- Reduced motion: the reward entrance snaps to its final value and the confetti
  component collapses under reduced motion; no new animation was added.

## Native verification

Executed on the exact final artifact during the resumption native pass; see
`FINAL_NATIVE_VALIDATION.md` (resumption section) for the weak/mid/strong
captures and `ACCESSIBILITY_RESPONSIVE_QA.md` for the matrix result.
