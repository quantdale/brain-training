# 010 — Rating History, Streak/Progress Correctness, and Composite Metrics

**Priority:** P2 with rating-integrity portions blocking  
**Depends on:** 002 and 009  
**Primary surfaces:** rating repository/history, progress/home/result queries, progression metrics  
**Shared DB/query owner:** orchestrator

## Problems to correct

1. Rating history can store the requested delta even when the rating floor clamps the actual movement.
2. Current rating `updated_at` can use repository write time rather than the contributing session's evidence timestamp, making imported/restored historical evidence look newly fresh.
3. Home reconstructs streak from only the latest 30 sessions, so sessions-per-day density truncates long streaks and can disagree with Profile.
4. Results loads only the latest global 50 rating movements and filters in memory, even though a per-session query exists. Older selected sessions can falsely show no movement.
5. The agreed transparent overall/composite cognitive score is not yet represented on Progress.
6. Home's Recent Games card loads recent data for personalization but still renders placeholder copy instead of real history.

## A. Rating history must record applied movement

When applying a delta:

```text
before = current rating or INITIAL_RATING
after = clampToFloor(before + requestedDelta)
appliedDelta = after - before
```

Persist `appliedDelta`, not the unclamped request, as the historical movement shown to the player.

If retaining requested policy delta is useful for diagnostics, store it separately with a clear name/policy version. Do not label it as actual movement.

Required invariant:

```text
rating_after(previous) + applied_delta == rating_after(current)
```

for a sequential domain history, accounting for initial rating on first row.

## B. Evidence time, processing time, and staleness

Separate concepts:

- `evidenceAt`: session completion timestamp whose performance changed the rating;
- `processedAt`: when this device applied/replayed/imported it.

`domain_ratings.updated_at` / staleness should reflect the most recent **evidence time** contributing to the projection, not merely migration/import time.

For normal immediate play they are nearly equal. For restore/sync/replay they can differ.

If sessions can be imported out of chronological order, define projection/replay ordering explicitly. Recommended: rating projection is deterministic in `(completedAt, stableSessionId)` order; incremental application of older evidence either triggers replay or is handled by an explicit policy. Do not silently pretend an old imported session is new evidence.

## C. Canonical daily activity query for streaks

Do not reconstruct streaks from an arbitrary session-count limit.

Add a repository/query that returns distinct local activity dates or the evidence needed to derive them across the required streak horizon. Options:

- `SELECT DISTINCT` on a persisted local-date field; or
- query all relevant completion timestamps and convert under the documented local-date policy.

Because timestamps alone do not preserve the original local timezone/date if the device later changes timezone, evaluate whether completed sessions need a persisted `local_date` evidence field for streak/quest purposes. If adding it, migrate/backfill carefully and document limits of legacy rows.

Home and Profile must use the same canonical streak service/query and agree for identical DB state.

Test high-density usage: e.g. 5–10 sessions/day over >60 days.

## D. Per-session results query

Results must call the existing/direct per-session rating-history query rather than fetching a global arbitrary limit and filtering.

For selected `sessionId`:

- load that session;
- load exact rating history for that session;
- load recent-session navigation separately.

No selected valid session should say “No rating movement” merely because newer history displaced it from a limit.

## E. Overall composite score

Implement the agreed transparent overall performance/composite score from domain ratings without presenting it as IQ or a medical/cognitive diagnosis.

Requirements:

- label as training/composite score, not intelligence quotient;
- explain how it is calculated in a short info/help surface or code docs;
- no domain with zero evidence should silently count as if measured at full confidence;
- stale domains do not automatically decay but can reduce composite confidence/coverage;
- score changes deterministically from domain rating state;
- expose both composite value and confidence/coverage indicator where needed so “4 measured domains” is distinguishable from “8 measured domains.”

Write a short ADR specifying aggregation. Recommended: weighted/trimmed or confidence-weighted average of normalized domain ratings, with coverage reported separately. Do not overcomplicate into a scientifically validated claim.

## F. Home recent games

Replace unconditional placeholder copy with actual recent game/session entries when data exists:

- game name;
- recent normalized/headline result or date as appropriate;
- link to game detail or result;
- true empty state only when no sessions exist.

Avoid duplicating a full Progress dashboard on Home.

## Required tests

### Rating history

- initial 1000 + delta -15 at floor-safe range records -15;
- rating 5 + requested -15 -> after 0 and applied delta -5;
- sequential history reconstructs exact current rating;
- requested/policy delta, if stored, is clearly separate.

### Evidence time

- immediate session: freshness uses completedAt;
- historical session processed today retains old evidenceAt;
- later evidence followed by older imported evidence does not incorrectly make updatedAt newer unless replay policy says so;
- staleness tests use evidence time.

### Streak

- 60+ consecutive local dates with 8 sessions/day reconstruct exact 60+ streak;
- duplicate session dates do not inflate streak;
- Home and Profile return same current/longest/at-risk state;
- leap day/timezone edge fixture documented.

### Results

- create >50 newer rating movements, then open an older recent/known session and assert exact movement still renders.

### Composite

- no measured domains -> explicit unmeasured/empty state;
- one/four/eight measured domains -> deterministic value + coverage;
- stale flag changes confidence/label, not stored rating;
- no IQ/diagnostic wording.

## MUST acceptance criteria

- Historical displayed delta equals actual stored rating movement.
- Staleness uses evidence time semantics.
- Home/Profile streaks use one canonical unbounded-by-session-count computation.
- Results queries rating history by session exactly.
- Composite score + coverage exists and is transparently documented.
- Home renders actual recent history when available.
- Targeted DB/UI tests, full suite, typecheck pass.

## Forbidden shortcuts

- Increasing Home's 30-session limit to 5000 and calling the streak bug solved.
- Using processing/import time as evidence time.
- Presenting the overall score as IQ or scientifically validated cognition.
- Treating unmeasured domains as confident initial-rating evidence.
- Keeping global rating-history limit filtering on Results.