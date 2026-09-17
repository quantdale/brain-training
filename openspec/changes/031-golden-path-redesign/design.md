# Design — Campaign 031 golden path

## Hierarchy

Today/Home owns one dominant `Start workout`/`Continue workout` CTA. The hero
shows only the plan length, an honest planning estimate, progress, current/next
leg, and a concise training rationale. Streak, XP, coins, reroll, focus
selection, and lower engagement surfaces remain available as compact secondary
content.

The existing persisted daily instance and template instance APIs remain the
source of truth. Presentation never creates a second instance or reselects a
game. The Home CTA retains the existing deep-link provenance tuple.

## Entry and play

The shared GameHost intro is one identity card: category/name, one concise
mechanic sentence, the workout position when owned by a workout, difficulty and
reward context, tutorial affordance, and one `Start game` action. The existing
tutorial store and first-use behavior stay untouched. Active play keeps the
board, essential HUD progress, and one Pause action; no game reducer or
generator is changed.

## Result and completion

Both the shared in-game result chrome and the `/results` route use the same
decision order: result headline, player-owned facts, bounded persisted reward,
then one primary continuation. An active workout exposes the next title and
position and makes `Next game` primary. The final leg exposes `Workout complete`
with an explicit total and makes `Finish workout` primary. Standalone results
retain `Play again`/`Done` behavior.

The existing `advanceWorkoutForSession` CAS and provenance checks remain the
only transition authority. UI changes consume their result and never perform a
second write. Completion remains safe to revisit because no new persistence
side effect is introduced.

## Accessibility and motion

Changed actions continue to use the shared Button/GameButton primitives and
their 44dp floor, semantic IDs, text scaling, theme tokens, reduced-motion
behavior, and screen-reader labels. New context cards are explanatory, not
interactive. Existing Campaign 030B localized Progress Detail findings remain
carried forward because that screen is outside this change.
