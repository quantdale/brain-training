# Campaign 003 — Platform Integration + Autonomy/Platform Gate: COMPLETED

**Completed:** 2026-08-17 (commits `c2680a2`…`4b3b4c4`)

## Deliverables (Phase 3 items)

1. **Workout personalization** — `src/workout/personalize.ts` (weak-domain
   balancing vs `INITIAL_RATING` threshold, recency avoidance, seeded
   composition) + `src/workout/reroll.ts` (first free, then 25×attemptsUsed
   escalating, cap 5/day). Home CTA wired: personalized 4-game workout,
   ledger-debited rerolls, live streak/XP/level stats.
2. **Quests/achievements foundations** — db schema v3 (`xp_awards` append-only
   with UPDATE/DELETE triggers, `quests`, `quest_progress`, `achievements`,
   `achievement_unlocks`; v2→v3 migration preserves rows) + repositories;
   `src/quests/` engine (versioned definitions, ISO-week/daily/longterm
   period keys, pure evaluation, once-only claims with XP award + ledger
   entry); `src/achievements/` (4 long-term definitions, pure evaluation,
   once-only unlock/claim); `src/progression/` seeding + sync at startup and
   Profile focus.
3. **Streaks + freeze/recovery** — `src/streaks/` pure reconstruction
   (leap-aware, unsorted/duplicates/future-tolerant), Freeze/Shield/Recovery
   with costs (100/150/200) + monthly freeze cap (3) + recovery restore cap
   (3 days); inventory in profile `settings_json`; Profile purchase UI with
   ledger debit; Home streak slot live.
4. **Stronger Progress dashboard** — `/progress-detail` (per-domain history
   with deltas, per-game records linking to game detail, recent sessions,
   empty states), entered from Progress tab "Full history"; lifetime XP now
   sessions + xp_awards.
5. **Themes/cosmetic seam** — `src/theme/registry.ts` (system/light/dark,
   pure resolution), persisted selection in profile settings, live switch via
   settings provider; Profile selector UI.
6. **Content-pack/storage seam** — `src/content/` registry fed by the language
   pack (`pack.json` validated via its own validator), deterministic size
   estimates, storage-management scaffold with graceful no-ops.
7. **Offline/network boundary** — `src/__tests__/offline-boundary.test.ts`
   (monkeypatched fetch/XHR/WebSocket throwers across db init, completeSession,
   rating, workout, quest/streak/content flows + in-test static scan) and
   `scripts/validate-offline.mjs` (214→223 files scanned, CLEAN).
8. **Visual baselines** — 4 deterministic snapshots (Home/Games/Progress/
   Profile first-run states; bare-route renders to avoid NativeTabs random
   screenIds). Game-level determinism covered by existing seeded tests.
9. **Perf/timing audit** — games use the SDK monotonic clock for all gameplay
   durations (`SessionLifecycle.elapsedMs` etc.); `Date.now()` appears only
   for wall-clock stamps, session ids and nonces. No 60/120 Hz fairness
   hazards found in timing paths.
10. **iOS compatibility** — static audit PASS (web-only `Platform.OS`
    branches; all deps cross-platform Expo SDK 57; `app.json` ios
    bundleIdentifier + icon valid; expo-sqlite/router/glass-effect/symbols
    iOS-capable). Real build: NOT VALIDATED — Windows host, no Xcode/macOS.

## Constitution §32 gate — checklist

| Gate item | Status | Evidence |
|---|---|---|
| Fresh-agent recovery works | PASS | Fresh subagents executed packets 003-a…f from zero context with only packets + repo state (this campaign) |
| Swarm partitioning/convergence works | PASS | 6 parallel coders, disjoint write surfaces, orchestrator convergence committed (wave3); no shared-file conflicts |
| No host-input interference | PASS | All automation emulator-local (adb/uiautomator); no mouse/keyboard injection (AGENTS.md policy) |
| Android emulator autonomously controllable | PASS | `braintraining35` headless AVD controlled via adb reverse + am start + uiautomator dump + input tap/swipe |
| QA failures produce useful diagnostics | PASS | Failure screenshots/hierarchy pattern from campaigns 001–002; offline validator prints file:line tables; console.error paths log startup/progression failures |
| All eight representative games function | PASS | 8 games registered (registry `--check` PASS); game suites 90 suites/1072 tests total; campaign-002 on-device playthrough evidence remains valid |
| Game SDK survives all represented mechanics | PASS | SDK untouched this campaign; quests/streaks/workout/content engines built on top; offline suite exercises SDK flows |
| Scoring/rating/XP/currency/progress persistence and Today's Workout work | PASS | Schema v3 on-device; live quest evaluation (3/3, 100/100), claim flow verified on-device (→ Claimed); reroll economics verified on-device (free → "Need 25 coins"); streak/XP/level live |
| Light validation/canary suite works | PASS | tsc 0 errors; jest 94 suites / 1072 tests / 4 snapshots; repo validator PASS; offline validator CLEAN; registry `--check` PASS; visual baseline snapshots stable across reruns |
| CI is green | PASS | App CI + Repository Integrity green on all pushed commits (`c2680a2`, `d46a46d`, `8d7dbe6`, `4b3b4c4`) |
| No unresolved Critical/High defect | PASS | No Critical/High findings this campaign; Medium/Low items recorded in KNOWN_ISSUES debt |
| Committed docs/state match repository reality | PASS | STATE/VALIDATION/CURRENT_CAMPAIGN/KNOWN_ISSUES/PARITY_MATRIX/task packets updated in this completion commit |
| Clean `main` pushed | PASS | `main` clean, pushed (see commits above) |

**Gate: PASS.** Phase 4 (mass catalog expansion) is now eligible.

## Notable artifacts

- `qa-artifacts/20260817-campaign003-smoke/progress-detail.xml` — device
  hierarchy proving progress-detail (domain history, per-game records).
- Emulator evidence (ad-hoc, this run): Home personalized workout + reroll
  ("Need 25 coins" after free reroll), Profile quests 3/3 & 100/100 with
  claims, qd3 claim → "3/3 · Claimed", achievements section, Dark theme
  switch → Active, Progress summary 20/200 XP to level 3, Full history →
  `/progress-detail`.
- `.agent/tasks/003-a…003-f` — packets (DONE).

## Known debt (recorded in KNOWN_ISSUES.md)

- Reroll `attemptsUsed` not persisted across restarts (resets daily in state).
- iOS build unverifiable on Windows host (NOT VALIDATED, not a defect).
- Settings sensory toggles remain in-memory (pre-existing debt).
- Claimed-but-unrewarded crash window documented (claim is the commit point).

## Handoff to Phase 4

Campaign 004 (Parallel Catalog Expansion) is staged in
`.agent/CURRENT_CAMPAIGN.md` and `.agent/GOVERNANCE.json`.
