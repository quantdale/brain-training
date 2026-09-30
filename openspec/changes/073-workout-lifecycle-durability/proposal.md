# Change 073 — Workout Leg Durability and Player Control

## Why

A Daily Workout leg is completed, persisted as a session, and then advanced in
the database by a *separate* step. Nothing reconciles the two.

The link between "this session belongs to that workout leg" and "advance the
leg" is an **in-memory** map (`pendingLaunches`) populated at session *start* and
read during `completeSession` to attach provenance to the session's stored
result. The advance itself is then performed by UI code after persistence
succeeds, guarded by a one-shot ref so it fires once per mount. If the process
dies after the session row is committed but before the advance runs, the
workout remains positioned on a leg the player has already finished. On the next
launch, the app has a persisted session proving the leg was played and a
workout row saying it was not completed. Nothing detects this, and the player
must replay the leg — with the already-awarded session sitting in their history.

Related, the same absence of a durable link causes a second defect: Home lets
the player launch a *future* leg ("Up next") with that leg's own `legIndex`, so
the ownership tuple the app hands out is false against the durable row. The
tuple is what both provenance attachment and leg advance trust, so a session
recorded for leg 3 while the workout sits on leg 1 is exactly the state the
missing reconciliation cannot repair.

The workout state machine also has no abandon or skip transition. A player who
does not want the current leg — a game they have played hundreds of times, or one
whose content they dislike — can only escape it through rerolls, which are capped
per day and escalate in cost. There is no free, intentional exit, which converts
a content preference into a paid action.

Finally, the reroll write path is materially weaker than the advance path: the
advance uses a compare-and-set that includes the row's status and validates the
stored list shape, while the reroll's compare-and-set omits the status and
performs no shape validation. Two code paths writing the same row with different
rigour is how a degenerate row eventually appears.

## What Changes

- Make leg completion durable: the completion of a leg and the advance of the
  workout position must reach a consistent state together, or be recoverable to a
  consistent state on the next launch, without relying on in-memory state that a
  process death discards.
- Remove the reliance on an in-memory provenance map as the sole link between a
  session and its leg, by deriving ownership from persisted state.
- Stop launching a future leg as if it were the current one; either disallow it
  or label it as a preview that does not consume the leg.
- Give the workout a deliberate abandon or skip transition that is free,
  explicit, and recorded.
- Bring the reroll write path up to the same compare-and-set rigor as the
  advance path, including status and stored-shape validation.

## Capabilities

### New Capabilities

- `workout-leg-durability`: the observable guarantees that a completed leg and
  the workout's stored position cannot disagree, that leg ownership is derived
  from persisted state, and that a player can intentionally leave a leg.

### Modified Capabilities

None. No existing capability spec exists under `openspec/specs/`.

## Impact

- `apps/mobile/src/db/workout.ts` — advance/reroll compare-and-set symmetry,
  status and shape validation, recovery scan.
- `apps/mobile/src/components/game-host/session-provenance.ts` — the in-memory
  bridge; ownership derivation.
- `apps/mobile/src/components/game-host/use-game-session.ts`,
  `components/game-host/results.tsx`, `src/workout/use-workout-result-advance.ts`
  — advance trigger.
- `apps/mobile/src/app/(tabs)/index.tsx` — "Up next" launch behavior and copy.
- `apps/mobile/src/db/index.ts` (repository surface) and bootstrap, for a
  startup reconciliation pass.
- No schema change is assumed; if reconciliation requires a durable marker, the
  design records the migration and its idempotency.
- No change to scoring, XP, currency, or reward amounts.
