## Context

006r specified sequential workout: persist game N → compact result with Next Game; do not return Home between legs. Implementation split the surfaces:

- In-game `GameResults` (`components/game-host/results.tsx`) is the compact result every GameHost game shows after persist. Actions: Play again + Done (`onQuit` → `router.back()`).
- Durable advance lives in `useWorkoutResultAdvance` → `WorkoutRepository.advanceForSession` (CAS on status/index/`updated_at`/seed/`game_ids_json`). The only production caller is `app/results.tsx`.
- Autobot `flowWorkout` encodes BACK Home → `home-recent-game-*` → `/results` as the official journey, so 4/4 daily-workout PASS does not prove 006r.

`completeSession` already stamps workout provenance on the session row. Advance is therefore possible from in-game results using the persisted record.

## Goals / Non-Goals

**Goals:**

- Run the existing CAS advance from the in-game results path after persist success.
- Show Next Game / completion on that surface.
- Keep `/results` idempotent.
- Update autobot to tap in-game Next Game.

**Non-Goals:**

- Changing provenance shape, selection, or reroll.
- Removing `/results` history.

## Decisions

1. **Reuse `advanceForSession`, do not add a second writer.** In-game results should call the same hook or a extracted `advanceWorkoutForSession(session)` used by both surfaces.
2. **Gate on persist success.** `GameResults` already receives `persistState`. Advance only when `'succeeded'` and `session.workoutProvenance` is present.
3. **Extend `GameResults` with optional workout slot** (`nextGameId`, `onNextGame`, `workoutCompleted`) so 42 screens inherit via the shared chrome rather than 42 copies. Screens that already pass `onQuit` keep Done for standalone play.
4. **Next Game navigates with `gameHref` + next provenance**, same as Home Continue.
5. **Autobot:** when `home-workout-*` launched the session, wait for in-game results Next Game; delete the Home-recent detour as the success path (keep it only as a fallback diagnostic).

## Risks / Trade-offs

- Double-advance: mitigated by existing CAS + `advancedForSessionRef` semantics; add a test: in-game advance then mount `/results` with the same id.
- Persist-then-crash before advance: 006r already requires no advance without persist; crash after persist before advance leaves Home Continue on the same game — acceptable (same as today's `/results` miss) if we also retry advance on Home Continue when provenance of the latest session matches current index (optional hardening, not required).
- Players who liked Done→Home: Done remains for standalone sessions; workout sessions get Next Game as primary.

## Testing strategy

- Unit: extract advance helper; CAS duplicate session id.
- Component: `GameResults` shows Next Game only when props supplied; persist failed hides it.
- Route: representative GameHost screen with workout launch provider → force-win → Next Game testID.
- Autobot self-test: Next Game candidate on in-game results XML.
