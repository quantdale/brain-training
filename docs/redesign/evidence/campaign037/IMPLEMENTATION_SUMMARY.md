# Campaign 037 — Navigation, State & Cross-Surface Coherence

Status: **COMPLETE** from source checkpoint `ad4e54a`.

## Observed problem

On a clean install with zero recorded sessions, Home described the generated
plan as “balanced across your recent training.” The phrase implied history
that did not exist. The route journeys themselves were operational, so the
bounded correction was copy/state coherence rather than a navigation rewrite.

## Product change

- `apps/mobile/src/app/(tabs)/index.tsx` now chooses the Home plan subtitle
  from the existing `data.recentSessions` state: a clean store says
  “a balanced starting set,” while a store with session history retains the
  history-aware wording.
- `apps/mobile/src/app/__tests__/home-workout-start.test.tsx` uses a visible
  one-game workout fixture and locks the clean-state branch against the old
  history claim.
- `apps/mobile/src/app/__tests__/app-shell.test.tsx` locks the observed
  Games → Game Detail → back stack and a recoverable missing Results deep link.

No router architecture, session identity, workout persistence, migration,
economy, backup/restore, gameplay, or registry behavior changed.

## Evidence

- Before/after native matrix and pixel comparison: `BEFORE_AFTER_NAVIGATION.md`
- Runtime/device evidence: `RUNTIME_VALIDATION.md`
- Accessibility audit: `ACCESSIBILITY_VALIDATION.md`
- Human/platform limits: `HUMAN_VALIDATION_PENDING.md`

