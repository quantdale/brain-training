# Durable Project State

**State schema:** 1
**Last update:** 2026-08-17 (Campaign 005 COMPLETED; 20-game catalog)
**Canonical branch:** `main`
**Active campaign:** `006-platform-hardening-and-polish` (Phase 6 — staged; next continuation goal executes it)

## Current status

**Campaign 005 (Catalog Depth and UX Polish, Phase 5) is COMPLETED.** 4 new
game modules added (one per high-traffic domain), 20-game catalog verified.
Checkpoint: `.agent/checkpoints/005-catalog-depth-and-ux-polish-complete.md`.

- **4 new games** (commit `4434d33`):
  - memory-pattern-tap-back (Memory) — 87 tests
  - speed-color-match (Speed) — 82 tests
  - math-equation-builder (Math) — 90 tests
  - language-sentence-builder (Language) — 83 tests
- **Registry regenerated**: 20 games, categories validated.
- **Convergence**: tsc clean, 177 suites / 2097 tests all green.

## Completed campaign 005 (commit)

- `4434d33` wave1: 4 games (pattern-tap-back, color-match, equation-builder, sentence-builder) + registry

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

Execute `.agent/CURRENT_CAMPAIGN.md` — Campaign 006 (Platform Hardening
and Polish, Phase 6): platform improvements and polish. No full hardening
unless the owner requests it.

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
