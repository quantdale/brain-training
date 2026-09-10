# Design — Campaign 023 Production & Gamification Overhaul

## Architecture stance

This campaign is a *presentation and shell* overhaul plus a functional audit.
It does not re-architect the Game SDK, database, scoring, or progression
systems. The design system stays centralized in `apps/mobile/src/theme/` and
shared primitives under `apps/mobile/src/components/`, and every game keeps
plugging into the existing Game SDK and host.

## Invariants to preserve

1. **Progression authority unchanged.** XP, levels, currency ledger, streaks,
   quests, achievements, and ratings keep their current semantics and
   persistence contracts. UI changes read authoritative state; they do not
   invent parallel state.
2. **Exactly-once persistence.** Session completion continues to write one
   session row and one award transaction behind the existing CAS/transaction
   gates. Celebration code must never run twice per completion event.
3. **Determinism.** Generators remain seeded and versioned; visual changes must
   not consume or perturb the game RNG stream.
4. **Accessibility contracts.** Existing a11y labels/roles/announcements and
   reduced-motion/sensory controls stay functional; new visuals degrade
   gracefully.
5. **QA hooks.** Test IDs and QA force-win/timeout paths remain intact and
   available in QA/dev builds only.
6. **Secret hygiene.** The Refero bearer token lives only in gitignored/user
   configuration.

## Design-system strategy

- Treat `theme/tokens.ts` as the single source of truth and extend it with
  named elevation, motion-duration, and semantic feedback tokens.
- Build/extend three shared primitives: tactile button treatment, feedback
  card, and progress meter; migrate screens to them rather than restyling
  screen-by-screen ad hoc.
- Celebration surface: reuse and extend `rewards/celebration.tsx` (already
  test-covered) instead of a new competing implementation.
- Keep per-game visual identity where the constitution allows it, but make
  chrome (session header, pause, results, difficulty selector) uniform.

## Risk controls

- Visual-baseline snapshots are expected to change; they are re-baselined in a
  dedicated, reviewable commit rather than deleted or skipped.
- Gameplay changes are limited to confirmed defects with regression tests.
- Runtime certification is re-run when the emulator is available; otherwise
  the gap is recorded as NOT VALIDATED.
- Shared-file hotspots (tokens, shell, host, registry) are edited by the
  orchestrator after parallel packets converge.
