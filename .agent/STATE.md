# Durable Project State

**State schema:** 1
**Last update:** 2026-08-17 (Campaign 004 COMPLETED; 16-game catalog)
**Canonical branch:** `main`
**Active campaign:** `005-catalog-depth-and-ux-polish` (Phase 5 — staged; next continuation goal executes it)

## Current status

**Campaign 004 (Parallel Catalog Expansion, Phase 4) is COMPLETED.** 8 new
game modules added (one per cognitive domain), 16-game catalog verified
end-to-end. Checkpoint:
`.agent/checkpoints/004-parallel-catalog-expansion-complete.md`.

- **8 new games** (commits `90a2da9` + `69fc2f5`):
  - attention-odd-one-out (Attention) — 90 tests
  - speed-tap-rush (Speed) — 88 tests
  - memory-sequence-memory (Memory) — 90 tests
  - math-missing-operator (Math) — 72 tests
  - language-word-scramble (Language) — 82 tests
  - logic-code-cracker (Logic & Problem Solving) — 91 tests
  - flexibility-color-stroop (Flexibility) — 74 tests
  - spatial-transform-match (Spatial) — 96 tests
- **Registry regenerated**: 16 games, categories validated.
- **Convergence**: tsc clean, 149 suites / 1755 tests all green.
- **Emulator smoke**: workout picks from expanded catalog; game screens
  render correctly with all testIDs.

## Completed campaign 004 (commits)

- `90a2da9` wave1: 4 games (odd-one-out, tap-rush, sequence-memory, missing-operator) + registry
- `69fc2f5` wave2: 4 games (word-scramble, code-cracker, color-stroop, transform-match) + registry

## Completed campaign 003 (commits)

- `c2680a2` wave1: db schema v3 (xp_awards, quests, quest_progress, achievements) + repositories
- `d46a46d` wave2-packets: 6 task packets (quests, streaks, content, offline, workout, progress-detail)
- `8d7dbe6` wave2: swarm deliverables (quests engine, streaks, content seam, offline proof, personalization, progress detail)
- `4b3b4c4` wave3: convergence (Home CTA + reroll economics, Profile quests/achievements/streaks/theme UI, progression seeding/sync, total-XP wiring, visual baselines)

## Completed campaign 002 (commits)

- `d0ff355` wave1: seven game modules + registry (8 games registered)
- `0c7690d` wave2: rating engine + db schema v2 + RatingService seam
- `2e439c5` wave3: shared platform UI (results, detail, search/filter, progress)
- `f5d8e01` wave4: Today's Workout (deterministic daily + free reroll)
- `0a16f68` wave5: focus-refresh for db-backed screens (QA findings)

## Next required action

Execute `.agent/CURRENT_CAMPAIGN.md` — Campaign 005 (Catalog Depth and UX
Polish, Phase 5): further catalog expansion and UX improvements. No
hardening unless the owner requests it.

## Important invariants

- Android-first autonomous QA; iOS later compatibility campaign.
- One emulator by default (dedicated AVD `braintraining35`).
- No host mouse/keyboard automation.
- Up to ~7 coder agents where work is safely partitioned.
- No autonomous full hardening.
- No autonomous force-push to `main`.
- GitHub `main` is canonical (remote: quantdale/brain-training).

## Recovery note

A fresh agent should not require the chat that created this repository. Read
`AGENTS.md`, the constitution, governance JSON, current campaign, state,
validation, and recent Git history before working. Recovery is demonstrated —
see `docs/RECOVERY_DRILL.md`. Environment watch items (emulator stability,
screencap black frames, typed-routes regeneration) are in
`.agent/KNOWN_ISSUES.md`.
