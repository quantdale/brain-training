# Audit map — Campaign 031

## Baseline

- Before implementation: Campaign 030B rendered/runtime evidence, preserved
  under `docs/redesign/evidence/campaign030b/**` and the external verified
  screenshot directories documented there.
- Implementation starting SHA: `44ba1533f4eb5ebcd795723f801633caee914e17`.

## Changed seams

| Surface | Source of truth | Required proof |
| --- | --- | --- |
| Today/Home | `useWorkout`, templates, existing router/provenance | focused Home tests, light/dark pixels, resume/relaunch |
| Intro/HUD | GameHost and existing game hooks | GameHost tests, representative family canaries, pause |
| In-game Results | `GameResults`, `advanceWorkoutForSession` | continuation/idempotency tests, next/final pixels |
| `/results` | `useWorkoutResultAdvance`, persisted session/rating reads | route tests, no duplicate writes, completion/relaunch |
| Accessibility | shared Button/GameButton/theme contracts | hierarchy/semantic IDs, target sizing, reduced-motion check |

## Protected contracts

SQLite schema/versioning, workout identity and provenance, deterministic
selection/generator/scoring metadata, lifecycle/timers, session identity,
rating/XP/currency/reward idempotency, tutorial persistence, registry
determinism, and offline behavior are evidence obligations, not redesign
surfaces.
