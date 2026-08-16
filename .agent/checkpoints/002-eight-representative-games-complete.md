# Campaign 002 — Eight Representative Games: COMPLETED

**Completed:** 2026-08-16 (commits `d0ff355`…`0a16f68`)

## Exit criteria — evidence

| Criterion | Status | Evidence |
|---|---|---|
| All eight representative games function (playable end-to-end on the emulator) | PASS | 8 games registered and rendering on AVD `braintraining35` (hierarchy dumps in `qa-artifacts/20260816-campaign002-smoke/`); math-fast-math played end-to-end (tutorial skip → start → QA force-win → results → persistence verified in pulled db); every game has deterministic full-session jest coverage (targeted suites 89–112 tests each, incl. screen integration with persistence) |
| Game SDK survives all represented mechanics (canary coverage) | PASS | All 7 new games consume SDK lifecycle/timing/RNG/pause/tutorial/QA/normalization contracts; SDK untouched by games; 906+ tests |
| Scoring/rating/XP/currency/progress persistence and Today's Workout work | PASS | On-device: schema v2 (`user_version=2`); session rows with authoritative pipeline XP (50); `domain_ratings` Math 1020/Speed 1010 after 2 sessions; `rating_history` 4 rows; `currency_ledger` 2× +10 gameplay; Home renders deterministic daily workout (4 games) + free reroll |
| Results screens + game detail screens + favorites/search basics exist | PASS | `/results` (summary + rating movement + recent sessions), `/game-detail/[id]` (records/favorite/versions/Play), library search + category chips + favorites-only filter — all verified on-device; favorite persisted (`game_favorites`) and filters correctly |
| Light validation/canary suite works; CI green | PASS | tsc 0 errors; jest 77 suites / 916 tests; web export PASS; registry `--check` PASS; App CI + Repository Integrity green on every pushed commit (waves 1–5) |
| No unresolved Critical/High defect | PASS | One QA finding (stale db-backed screens after navigation return) fixed in wave5 and re-verified on-device; no other Critical/High |
| Committed docs/state match repository reality; clean `main` pushed | PASS | `main` clean at `0a16f68`; STATE/VALIDATION/CURRENT_CAMPAIGN/KNOWN_ISSUES updated in the completion commit |

## Notable artifacts

- `qa-artifacts/20260816-campaign002-smoke/` — device db (pulled), hierarchy
  dumps (progress, games favorites filter, game detail after session, math
  results), logcat.
- `.agent/tasks/002-a…002-h` — packets (DONE).
- ADR: none required (rating pipeline is a documented engine module, not an
  architecture change; `docs/GAME_SDK.md` references remain valid).

## Handoff to Phase 3

Campaign 003 (Platform Integration + Autonomy/Platform Gate) is staged in
`.agent/CURRENT_CAMPAIGN.md`. Phase 4 (mass catalog expansion) is NOT
eligible until the constitution §32 gate passes.
