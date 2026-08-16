# Campaign 003 — Platform Integration + Autonomy/Platform Gate (Phase 3)

**Status:** ACTIVE (staged; work begins on the next continuation goal)
**Campaign type:** implementation
**Hardening:** NO — light/risk-based validation only (gate runs at the end)
**Parent plan:** `docs/MASTER_PLAN.md` Phase 3

## Context

Campaign 002 (Eight Representative Games, Phase 2) is COMPLETED
(`.agent/checkpoints/002-eight-representative-games-complete.md`): eight
games, rating engine, schema v2, results/detail/library/progress UI, Today's
Workout basics — all verified on the dedicated AVD `braintraining35` and in
CI. Phase 4 (mass catalog expansion) MUST NOT start before the constitution
§32 gate is satisfied.

## Objective

Finish the platform integration work of Phase 3 and then run the
Autonomy + Platform Gate:

1. **Today's Workout personalization** — reroll economics (first free, then
   coins), weak/declining-domain balancing inputs (from ratings + session
   history), recency avoidance, deterministic date-derived seeds (exists;
   extend).
2. **Quests/achievements foundations** — daily/weekly quest data model,
   long-term achievement definitions, XP/currency rewards (constitution §18).
3. **Streaks + freeze/recovery data model** — streak reconstruction from
   activity history, Freeze/Shield + Recovery with defined costs/limits
   (constitution §18); UI on Home streak slot.
4. **Stronger Progress dashboard** — deeper per-game analytics one tap away,
   overall/domain history views, records list (constitution §21).
5. **Themes/cosmetic architecture seams** — theme registry seam (no full
   cosmetics store), avatar/background seams without gameplay impact
   (constitution §20, §33 boundaries).
6. **Content-pack versioning/storage management seam** — pack version
   registry + storage management scaffold (constitution §24).
7. **Offline/network boundary tests** — prove core flows never touch the
   network and degrade gracefully (offline-first, constitution §5).
8. **Visual-regression seed baselines** — deterministic seed baselines for
   key screens (canary set), light, not a full hardening campaign.
9. **Performance/timing checks** — timing-sensitive games fair across
   60/120 Hz (audit), startup/perf sanity checks (constitution §20).
10. **First iOS compatibility build** — `expo run:ios`-equivalent
    verification or documented build; fix what is cheaply fixable; record
    findings (iOS is a compatibility campaign, not full iOS QA).

Then run the **Autonomy + Platform Gate** (constitution §32): fresh-agent
recovery, swarm partitioning/convergence, no host-input interference,
autonomous emulator control, QA diagnostics, eight games function, Game SDK
survives all mechanics, persistence + Today's Workout work, light
validation/canary suite, CI green, no unresolved Critical/High defects,
committed docs/state match reality, clean `main` pushed. Record gate results
in a checkpoint; do NOT enter Phase 4 until every gate item is satisfied or
explicitly waived by the owner.

## Shared-file ownership rule

Orchestrator owns navigation, db schema/migrations, theme tokens, generated
artifacts, package manifests, and any new shared seams (quest/streak/theme
registries). Parallel coders may own isolated new modules (quests, streaks,
achievements, storage management) with explicit write surfaces only.

## Light validation required

- repository-state validator; typecheck + jest (whole tree)
- web export smoke; registry generator `--check`
- targeted emulator smoke for changed surfaces (one AVD)
- offline-boundary test evidence (no network calls during core flows)
- iOS compatibility build evidence or recorded blocker
- no host-input proof maintained

## Exit criteria

- all Phase-3 items above implemented to basic-but-real standard
- gate checklist recorded with PASS/NOT VALIDATED per item (never fake green)
- no unresolved Critical/High defect
- committed docs/state match repository reality; clean `main` pushed

## On completion

Archive checkpoint; the Phase 4 campaign (Parallel Catalog Expansion) becomes
eligible only after the gate is satisfied or explicitly waived; otherwise
report the gate gaps and stop.
