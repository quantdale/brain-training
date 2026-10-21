# Design — 080-native-product-quality

## Context

Campaign 080 is a bounded product-quality, native-validation, performance, and
release-certification campaign. The runtime architecture (React Native + Expo +
TypeScript, SQLite, offline-first, generated registries, shared Game SDK,
42 self-contained game modules) is settled and validated through Campaigns
077–079. This change therefore adds no game mechanic and no new runtime
architecture; it expands real native coverage, exercises critical journeys,
delivers measured performance improvement, corrects confirmed defects, and
keeps the certification record honest.

## The native automation problem

Campaign 079 natively journeyed only one game because UIAutomator hierarchy
dumps took ~4–5s while game timers ran ~9–10s, so timed interactions were hard
to reach reliably. The fix is not to slow production timers. The app exposes a
rich semantic surface: every game publishes `gameId.control` resource-ids
(`attention-odd-one-out.tile.0`, `.pause`, `.resume`, `.quit`, `.next-round`,
`.score`, `.round.N`, …). A harness can (1) deep-link straight to a game via
`braintraining://game/<id>`, (2) pre-capture the hierarchy before entering a
timed round to learn stable control bounds, (3) inject deterministic
emulator-local taps through `adb shell input`, and (4) capture screenshots
outside the timed window. This keeps automation emulator-local (no host input)
and reuses the established `scripts/android/` harness.

## Coverage levels (honest accounting)

- **Level 1 — native smoke:** launch, routing, identity, controls render, safe
  exit.
- **Level 2 — native interaction:** tutorial/difficulty, start, valid input,
  invalid input where meaningful, feedback, round advance.
- **Level 3 — full lifecycle:** complete/fail a session, results, scoring,
  persistence, replay, pause/resume/quit.
- **Level 4 — resilience:** background/relaunch, interruption, reduced motion,
  large font, compact screen, offline, unusual input.

The ledger records the deepest level actually reached per game. A lower level
is never reported as a higher one.

## Performance method

Controlled repeatable scenarios (cold launch, idle, scrolling, navigation,
timed gameplay, round transitions, results), multiple samples, counters reset
between scenarios, instrumentation overhead accounted for. Application-
controlled bottlenecks (rerenders, heavy decode, synchronous work, list
virtualization, DB churn) are profiled, corrected, and re-measured. Emulator
SwiftShader/software-rendering cost is separated by controlled comparison and
is not "fixed" by rewriting healthy app code.

## Ownership and convergence

The orchestrator owns governance, integration, certification, the single
dedicated emulator, and final convergence. Isolated packets own disjoint
`apps/mobile/src/**` surfaces (self-contained game modules, named component
files) or read-only audits. Shared hotspots (package manifests, lockfiles,
navigation registries, SDK contracts, generated indexes, global config) are
orchestrator-owned; subagents report shared-file needs and the orchestrator
performs convergence edits once. No host-input automation.
