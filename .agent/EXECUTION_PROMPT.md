# Execution Prompt — Campaign 014: Experience Depth & Replayability

Status: ACTIVE
Planned-From: 69af63a (campaign013 COMPLETED head)
Planned-At: 2026-08-26
Target-Branch: main
Authorization: explicit owner directive (session prompt, 2026-08-26) —
product-expansion campaign; Campaign 013 certification is not reopened.

## Mission

Transform Brain Training from a technically complete release candidate into a
substantially deeper, more replayable long-term product. Central question:
would someone still want to use it repeatedly after weeks? Depth over feature
count. Full mission, workstreams W1–W10 and completion gates live in
`.agent/CURRENT_CAMPAIGN.md` (owner directive §21).

## Behavior to preserve

- Offline-first; SQLite canonical; no server/social/leaderboard additions.
- Deterministic seeded generation with versioned semantics; historical data
  stays attributable (bump versions on material changes, never silently
  reinterpret).
- Reroll economics and progression integrity (XP/ratings/currency ledger).
- Game modules stay self-contained behind the shared SDK; no universal
  challenge/mastery mega-abstraction — small composable contracts.
- One emulator (`braintraining-qa36`); foreground preflight before trusting
  device evidence; never drive host input.
- Deferred product decisions (branding, accounts, sync, payments, ads, AI,
  social, notifications, store) remain deferred.

## Ordered workstreams

W1 audit → W2 mastery → W3 challenges → W4 Workout V3 → W5 Progress V3 →
W6 Home/discovery → W7 generator quality → W8 repeated-use simulation →
W9 feel/perf/a11y/storage → W10 validation & closure. Waves may overlap where
write surfaces are disjoint; orchestrator owns shared hotspots (schema,
registry, workout kernel, navigation, package manifests).

## Test/validation requirements

Risk-based per wave (tsc, targeted Jest, validators). At convergence points:
full Jest + lint + registry/provenance/ownership/offline checks + web export +
doctor. Device validation for Workout V3 E2E + representative game journeys +
repeated-day journey; full 42-game certify run if shared lifecycle changes
materially affect all games. Never fake green.

## Completion gate

All §21 criteria satisfied with evidence; terminal checkpoint written;
EXECUTION_PROMPT marked COMPLETED only then.
