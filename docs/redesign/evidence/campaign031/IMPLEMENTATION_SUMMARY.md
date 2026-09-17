# Campaign 031 implementation summary

Campaign 031 implements only the golden path:

`Home → Start/Continue → Intro/Tutorial → Gameplay → Result → Next → Completion`

## Product surfaces

| Surface | Structural change | Contract deliberately retained |
| --- | --- | --- |
| Today/Home | One dominant Today CTA; plan estimate, progress, current next leg, and rationale are adjacent. Context metrics and workout configuration are outlined secondary surfaces. | Existing `useWorkout` creation/resume/reroll flow, selected template, daily instance, and `gameHref` provenance target. |
| Workout handoff | Home and GameHost expose game position and expected duration without recreating the instance. | `WorkoutSessionLaunchProvider`, persisted `WorkoutSessionProvenance`, deterministic seed/selection metadata. |
| Intro/tutorial | Concise first mechanic sentence, identity/category, difficulty/time metadata, example, and one `Start game` action. | Game-specific tutorial content, first-use persistence, QA-only skip/demo controls, and game start lifecycle. |
| Active gameplay | Shared shell remains board-first with essential score/round/timer and one Pause action. | Game reducers, generators, scoring, timers, lifecycle/background auto-pause, session IDs, and mechanics. |
| In-game Results | Outcome and facts lead; reward is bounded; Next Game is primary; final completion is explicit; standalone results retain replay behavior. | Existing `advanceWorkoutForSession` CAS, persistence state gate, reward/XP/currency writes, rating history, and restart/quit controls. |
| `/results` | Same outcome/facts/reward/Next-or-Finish hierarchy for the route-level result view. | Existing result lookup, route provenance, CAS advance, rating display, and recent-session behavior. |
| Completion | `Workout complete`, `4/4 games complete`, saved-copy, one Finish action, and direct return to Today. | Existing completed workout state and exact-once writes; no new completion record or schema. |

## Source/test inventory

Product source files changed:

- `apps/mobile/src/app/(tabs)/index.tsx`
- `apps/mobile/src/app/results.tsx`
- `apps/mobile/src/components/game-host/game-host.tsx`
- `apps/mobile/src/components/game-host/results.tsx`
- `apps/mobile/src/components/game-ui/game-button.tsx`
- `apps/mobile/src/components/workout/template-details.tsx`
- `apps/mobile/src/workout/templates.ts`

Focused tests/snapshots changed:

- `apps/mobile/src/components/game-host/__tests__/game-host.test.tsx`
- `apps/mobile/src/components/game-host/__tests__/in-game-workout-actions.test.tsx`
- `apps/mobile/src/app/__tests__/__snapshots__/visual-baselines.test.tsx.snap`

Supporting campaign control/evidence files are the Campaign 031 OpenSpec
package, `.agent` terminal state, and the documents in this directory. No
game, schema, dependency, CI, generated registry, or persistence source file
was modified.

## Design decisions

- The Home CTA is singular and continues to the persisted current leg. A
  completed workout does not offer a misleading new `Start workout` action.
- Duration is an honest plan estimate stored with the versioned length spec;
  it is not a gameplay timeout and does not alter scoring or session timing.
- Reward feedback is still visible but follows the result facts, preventing
  XP/coins from competing with the player’s understanding of what happened.
- `Next game` carries the exact next provenance tuple. Final `Finish workout`
  uses a root replacement because each next-leg transition is pushed; generic
  back would return to the previous result.
- The existing GameHost and GameResults seams remain the only shared transition
  surfaces. No second workout controller or persistence path was introduced.
