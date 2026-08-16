# Durable Project State

**State schema:** 1
**Last update:** 2026-08-17 (Campaign 003 COMPLETED; §32 gate PASS)
**Canonical branch:** `main`
**Active campaign:** `004-parallel-catalog-expansion` (Phase 4 — staged; next continuation goal executes it)

## Current status

**Campaign 003 (Platform Integration + Autonomy/Platform Gate, Phase 3) is
COMPLETED.** All Phase-3 items implemented to a basic-but-real standard and
the constitution §32 mass-expansion gate PASSED (checklist in
`.agent/checkpoints/003-platform-integration-complete.md`). Deliverables:

- **DB schema v3** (`c2680a2`): append-only `xp_awards` (UPDATE/DELETE
  triggers), `quests`, `quest_progress` (monotonic-MAX, once-claim),
  `achievements`, `achievement_unlocks` (once-unlock/claim); v2→v3 migration
  preserves rows; 7 repositories on the `AppDatabase` facade.
- **Quests engine** (`8d7dbe6`): versioned daily/weekly/longterm definitions,
  ISO-week/daily/longterm period keys, pure evaluation over session
  snapshots, once-only rewards (XP award + ledger entry).
- **Streaks model**: pure reconstruction (leap-aware, at-risk flag),
  Freeze/Shield/Recovery costs 100/150/200 with monthly freeze cap and
  recovery restore cap; inventory in profile `settings_json`.
- **Achievements engine**: 4 long-term definitions, pure evaluation,
  once-only unlock/claim rewards.
- **Workout personalization** (`4b3b4c4` convergence): weak-domain balancing,
  recency avoidance, reroll economics (first free, then 25× escalating, cap
  5/day) — Home CTA wired with ledger-debited rerolls and live
  streak/XP/level stats.
- **Progress detail** (`/progress-detail`): per-domain history with deltas,
  per-game records, recent sessions; lifetime XP = sessions + xp_awards.
- **Theme registry seam**: system/light/dark persisted in profile settings,
  live switching; Profile selector.
- **Content-pack/storage seam**: registry fed by the language pack with
  deterministic size estimates + storage scaffold no-ops.
- **Offline boundary proof**: jest suite with network throwers +
  `scripts/validate-offline.mjs` (223 files scanned, CLEAN).
- **Visual baselines**: 4 deterministic shell-screen snapshots.
- **Perf/timing audit**: gameplay durations use the SDK monotonic clock;
  `Date.now()` only for wall-clock stamps/nonces.
- **iOS compatibility**: static audit PASS; real build NOT VALIDATED
  (Windows host, no Xcode) — recorded honestly in VALIDATION.md.

On-device QA (`braintraining35`, Metro-served JS): personalized workout +
reroll economics verified, quests evaluated live (3/3, 100/100), qd3 claim →
Claimed, achievements section, Dark theme switch live, Progress summary +
Full history → progress-detail. Evidence: `qa-artifacts/20260817-campaign003-smoke/`.

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

Execute `.agent/CURRENT_CAMPAIGN.md` — Campaign 004 (Parallel Catalog
Expansion, Phase 4): swarm waves adding a second game per cognitive domain
toward the parity matrix, keeping shared-file contention minimal and
validation moderate. No hardening unless the owner requests it.

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
