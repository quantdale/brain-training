# Proposal — 080-native-product-quality

## Why

Campaign 079 closed CONDITIONAL GO with a green engineering foundation but
left whole-product quality unproven: only 1 of 42 games was journeyed natively,
correct-answer scoring and Pause/Resume/Quit were not freshly validated,
offline airplane-mode behavior was untested, persistence/upgrade/recovery paths
were incomplete, accessibility and responsive acceptance remained open,
emulator frame performance was poor with no runtime optimization delivered,
several visual/gameplay P3 findings persisted, the certification referenced an
earlier qualified SHA than the final integrated commit, administrators retain a
documented path to bypass classic required-status checks, and physical-device/
iOS-runtime/owner acceptance remain external. The owner authorized this bounded
successor campaign to close every achievable gap.

## What Changes

- Enumerate the live game registry and build a native QA matrix + machine-
  readable coverage ledger driven by the real automation surface.
- Fix the native automation bottleneck (slow UIAutomator dumps vs. game
  timers) using stable accessibility identifiers, pre-captured hierarchy, and
  deterministic emulator-local input so time-sensitive interactions are
  reachable.
- Expand native gameplay coverage toward all 42 games at the deepest level the
  supported environment allows, with honest per-game level accounting.
- Execute critical end-to-end journeys natively: golden path, correct/incorrect
  scoring, Pause/Resume/Quit, Workout V3, results/progression/rewards, and a
  real offline airplane-mode journey.
- Diagnose runtime performance under controlled scenarios, separate emulator
  overhead from application-controlled cost, and implement evidence-based
  optimizations with before/after comparison.
- Reassess and correct confirmed visual/gameplay P3 findings and any promoted
  P2 defects; converge accessibility and responsive layout within available
  tooling.
- Expand persistence, offline, upgrade, backup/restore, and recovery testing
  with safe data isolation.
- Reduce platform-qualification and governance gaps: honest separated platform
  status, final-SHA certification reconciliation, and a reviewed
  administrator-bypass posture.

## Capabilities

### New Capabilities

- `native-product-quality`: A truthful, reproducible whole-product quality
  contract — native game-catalog coverage is explicit and honest, critical
  journeys are exercised at runtime, performance findings are evidence-based
  and optimized where justified, and platform/certification status stays
  truthful across separated tiers and reconciled revisions.
