## Why

The product is functional, but its on-device experience still reads as a collection of oversized, repeated panels rather than a cohesive, playable brain-training app. A release-build Android baseline at `d3d0b9926a44c039d7fd0d29e1376586afaa897b` shows catalog content and first-run actions displaced by decorative stages; the issue spans navigation, gameplay composition, feedback, and large-text ergonomics, so another palette-only pass cannot solve it.

## What Changes

- Establish a distinctive, Refero-informed visual and interaction direction by prototyping **three genuinely different** systems on real product flows, comparing them against current-device evidence, then documenting one selected reference lock before rollout. Adapt patterns; do not clone any reference brand.
- Redesign the complete user journey: Home and workout entry/resume/completion; Games search, filters, empty and favorite states; game detail/tutorial; all 42 games' active play, feedback, pause/quit, timeout, result, and error/recovery states where applicable; Progress/insights; Rewards; Profile/settings; storage/data and results routes. Preserve offline-first behavior and current scoring, progression, economy and persistence semantics.
- Deliver a shared compositional system for type, semantic color, artwork, touch, motion, audio/haptics and accessible state feedback, plus game-specific board/interaction designs so 42 games do **not** become identical reskins. Maintain semantic IDs and safe dev-only fixtures.
- Make visual quality a device gate: matched before/after captures, route/state and 42-game coverage manifest, light/dark and large-text/small-device checks, screenshot inspection, ARTEMIS-led Android journeys, regressions and a final visibly transformed release APK. Never close on documentation, token changes, or green tests alone.

## Capabilities

### New Capabilities

- `product-experience`: Discoverable, legible and coherent navigation, workout, result, progression, reward, profile and recovery experiences across supported themes and sizes.
- `gameplay-experience`: Mechanic-specific playfield, instruction, feedback and session-state experience for every registered game, with shared accessibility and interaction contracts.
- `experience-certification`: Traceable visual baselines, comparison criteria and release-device coverage for product-wide UI/UX changes.

### Modified Capabilities

- None. `openspec list --specs` reports no main specs at proposal time; historical change-local deltas are not assumed to be active main specs.

## Impact

- React Native/Expo routes in `apps/mobile/src/app/`, shell/discovery/workout/progress/rewards components, `apps/mobile/src/theme/`, `apps/mobile/src/components/ui/` and `game-ui/`, and all 42 `apps/mobile/src/games/*/` modules (209 per-game component `.tsx` files at baseline). All 42 screens already use `GameHost` and `GameResults`, but those shared wrappers do not own each game's active board and feedback.
- Device QA: dedicated Android AVD, release APK, ARTEMIS runtime journeys, screenshot/hierarchy/manifest evidence, existing deterministic tests and impact-map checks. iOS remains in scope for layout/interaction review where tooling is available; Android is the primary autonomous device gate.
- No new online service, account requirement, scoring rule, generator or database migration is proposed. Any later consequential architecture change requires an ADR and product-constitution compatibility review.
