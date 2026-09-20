# Design — 056-workout-lifecycle-integrity

## Substitution algorithm (pure, deterministic)

```
reconcileWorkout(instance, eligibleIds):
  if (!instance) return { instance: null, changed: false }
  eligible = toSet(eligibleIds)
  oldIndex = clamp(trunc(instance.currentIndex) or 0, 0, instance.gameIds.length)

  played  = instance.gameIds.slice(0, oldIndex)          # verbatim, history immutable
  future  = dedupeFirst(instance.gameIds.slice(oldIndex) # eligible only
              .filter(id => eligible.has(id)))
  present = new Set([...played, ...future])
  substitutes = [...eligible]                             # pool order = registry order
     .filter(id => !present.has(id))
     .slice(0, instance.gameIds.length - played.length - future.length)
  gameIds = [...played, ...future, ...substitutes]

  if (gameIds.length === 0) return { instance: null, changed: true }

  if (instance.status === "completed") {
    newIndex = min(oldIndex, gameIds.length)              # clamp only, never resurrect
    status = "completed"
  } else {
    newIndex = oldIndex
    status = newIndex >= gameIds.length ? "completed" : "active"
  }
  changed = list differs || newIndex !== currentIndex || status !== status
  return changed ? { instance: {...instance, gameIds, currentIndex: newIndex, status}, changed: true }
                : { instance, changed: false }
```

Notes:

- `newIndex = oldIndex` always holds in the active branch because positions
  below `oldIndex` are untouched and length is preserved whenever a
  substitute exists. The old `validBeforeOld` recomputation is deleted.
- When `oldIndex` was clamped (corrupt negative/huge index), the played
  prefix is defined by the CLAMPED index — same contract as before, only the
  future handling changes.
- Empty-`gameIds` corrupt rows yield `gameIds = []` → `null` (regenerate),
  identical to the old empty-list rule.
- Completed rows keep `completed` even if reconciliation would otherwise
  shorten them (old code could flip active→completed but never completed→
  active; the new code additionally refuses to resurrect via clamping).

## Bound constant

`templates.ts` owns game counts (`short 2 / standard 4 / extended 6`).
Add `MAX_WORKOUT_LEG_INDEX = 5` next to the length specs with a comment
deriving it from `extended`. `route-params.ts` imports it (no cycle:
routing already imports registry/sdk; templates imports … check: templates
imports rng/seed utilities — verify no cycle with routing before wiring; if
a cycle threatens, duplicate the literal with a cross-reference comment and
a contract test asserting equality).

`isWorkoutSessionProvenance` gains `legIndex <= MAX_WORKOUT_LEG_INDEX` and
`instanceKey.length/gameId.length <= MAX_ROUTE_PARAM_LENGTH (128)`.

## Hook surface

Delete `advance` from `useWorkout` (implementation + return type). Migrate
`use-workout.test.ts`, `lifecycle.test.ts`, `reroll-partial.test.ts` to
`db.workouts.advance(date)` + `refresh()`. The db primitive keeps its name
and semantics (tests + template flows use it as an explicit control); its
doc comment is sharpened to forbid UI use. `advance()`/`applyReroll()`
throw on empty `gameIds`.

## Consumer audit (display-vs-durable)

- `db.workouts.reconcile` — persists when changed. Unchanged code path, new
  pure semantics flow through. ✔
- `session-advance.ts:101` (`shouldAdvance=false` nav path) — pure reconcile
  of the live row for navigation. After this change the row is repaired +
  persisted at load time in every real flow, making the pure call a no-op;
  but a stale row (reconcile never ran) could now substitute in memory and
  point Next at an unowned game. Fix: persist-when-changed here via
  `db.workouts.reconcile(date, …)` before computing navigation (async
  context, idempotent).
- `session-advance.ts:113-124` (post-advance path) — already persists via
  `db.workouts.reconcile`; pure call is a no-op after. ✔ (add a comment).
- `use-workout-result-advance.ts` (memo display) — IMPLEMENTED as
  effect-persist: on the non-advance path, when the pure repair reports a
  change, persist once per session via `db.workouts.reconcile` (idempotent)
  and emit the workout-changed event so Home converges. The advance path
  already repairs through `advanceWorkoutForSession`.
- `app/__tests__/results-workout-cta.test.tsx:111` — test-only reconciler;
  update expectations if fixtures drift.

## Known residual (accepted, bounded)

An in-flight launched leg can be stranded when a drift repair persists
between launch and commit: the committed session saves standalone (never
lost) and the substitute leg is owed. No false credit is possible. This is
strictly better than truncate-and-complete and is recorded for the 065
adversarial re-probe.

## Test strategy

Red-before-green for: substitution on retired future leg; played-history
immutability; fallback truncation; completed-immunity; envelope 6..31
rejection; empty-row advance throw; restart re-registration; retry-keeps-map;
explicit-provenance-without-map. Update old truncation tests honestly
(they pin superseded semantics — rewrite, don't delete coverage).
