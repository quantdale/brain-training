# Current route/state and architecture inventory

Independent read-only source/test audit at `624a5a771a8fc1b3a7b83bb0a8227e68a90052d2`.
This completes the route/state discovery inventory; it does not grant native
acceptance to every listed state. Existing tests below were inspected, not
re-executed by the inventory agent. Root owns integration and device evidence.
Earlier visual findings/decisions remain in [PRODUCT_AUDIT.md](PRODUCT_AUDIT.md).

There are15 shipping leaf routes plus one development-only prototype. Paths
in this record are relative to `apps/mobile/src/`. Tutorial, pause, feedback,
confirmation and celebration are states within these routes, not extra routes.

## Routes and state families

| Route / decision | Current states and observable controls | Inspected source/caller evidence |
|---|---|---|
| `(tabs)/index.tsx` Home — REDESIGN | Progress pending, read failure/retry, genuine first-use zero, populated engagement/history; independent workout loading/error/empty catalog, fresh/active/completed/skipped plan; template/length/reroll/skip/jump, recent/favorite games, completion banner and long scroll. `home-loading`, `home-progress-unavailable`, `home-data-retry`, `home-workout-loading/error/empty/continue`, `home-workout-options`, `home-recent-games` | `home-data-availability`, `home-workout-start`, `home-reroll-failure`, `home-skip-copy`; exact source repairs in HOME_READ_AVAILABILITY.md. Data07 final Home proves retained native07 data, not the new loading guard |
| `(tabs)/games.tsx` Games — REDESIGN | Registry-empty; activity loading/read error/retry; recommendation; search/clear/keyboard; category/favorite combinations; unavailable versus genuinely empty favorites; no matches/reset; horizontal filters/vertical catalog. Rows below360dp or fontScale≥1.5. `games-search/filters/data-error/favorites-unavailable/favorites-empty/no-results/grid` | `games-library` covers search/filter/favorites/failure/retry/empty catalog; `discovery/discovery-data.ts` owns focus-refreshed snapshot and stable evidence |
| `(tabs)/progress.tsx` Progress — REDESIGN | Loading/error/retry, new-player explanation, current rating/fresh-stale-unseen domains/activity/recent sessions;7d/30d/90d/All windows; explicit insights expansion; volume/balance/records/workouts/category detail below fold. `progress-loading/error/empty/window-selector/insights-toggle/insights/domain-*` | `progress-insights`, focus throttling/progression-focus-sync; PROGRESS_WAVE.md distinguishes performance from rating and selected-window facts |
| `(tabs)/profile.tsx` Profile — REDESIGN | First-load skeleton, read failure/retry, seeded/populated identity; System/light/dark/SFX/haptics; optimistic-save failure toast; streak inventory/affordability/in-flight/apply outcomes; milestones/quests/achievements collapsed/expanded; Rewards/Data destinations. `profile-loading/error/identity/preferences/settings-theme-*/streak-*/quests-toggle/achievements-toggle` | `profile-layout`, `profile-purchases`, settings persistence/concurrency/toast callers. Preserve real inventory/transactions, compact2x reflow and deliberate disclosure |
| `game-detail/[id].tsx` Game detail — REFINE | Unknown/malformed without Play; known first play; stats loading/error/retry; mastery/records/history; favorite pending/error; metadata disclosure; historical back/cold-link Games fallback. `game-detail-unknown/play/favorite/fav-error/loading/error/first-play/information-toggle` | `game-detail` covers identity/action order/populated/unknown; `app-shell` covers Games return. Explicit rejected stats/favorite-read retry coverage was not found in its four detail tests |
| `game/[id].tsx` Game — REDESIGN presentation, KEEP lifecycle | Unknown/missing renderer; tutorial hydration; lazy loading/module failure boundary; first tutorial/replay; intro/difficulty/start; active/pause/resume/quit; feedback; saving/failed/saved results; standalone/next leg/workout complete/advance retry. `game-not-ready-*`, `error-boundary-retry`, SDK game-prefixed intro/start/help/tutorial/stage/pause/resume/quit/results/persist-error/workout-advance-retry IDs | Route/registry/lazy-loader/tutorial-persistence/GameHost/duplicate-start/persistence-failure/workout-action/error-boundary/pause/tutorial layout and a11y tests; all42 game detail remains in GAME_AUDIT/CURRENT_SOURCE_DISPOSITION |
| `results.tsx` Saved results — REDESIGN | Loading/error/retry; absent/missing/latest/explicit session; weak/normal/PB outcome; persisted XP/coins/rating facts; replay/next/finish/advance failure; session switching/scroll. `results-loading/error/empty/summary/band/reward/next-game/finish-workout/persist-error` | `results-hero`, `results-workout-cta`, `app-shell`; weak outcomes and skipped/played completion are explicit; display does not re-award value |
| `progress-detail.tsx` Training history — REFINE | Loading/error/retry; empty Browse games; populated PB/domain/game/session evidence; bounded domain tail with Show more/fewer; long scroll/safe Progress back. `progress-detail-loading/error/browse-empty/domain-toggle-*/session-*` | `progress-detail` covers empty/populated/tail/overview link; explicit rejected-read/retry caller coverage absent in that file |
| `progress-activity.tsx` Activity — KEEP/REFINE | Loading/error/retry; empty Browse games; populated summary/calendar/runs/distribution/weekdays/monthly frequency; responsive stacked summary and long scroll. `progress-activity-loading/error/empty/summary-layout/calendar` | Trained calendar/frequency in `progress-insights`; explicit Activity empty/error-retry tests not found there, though source branches exist |
| `progress-domain.tsx` Domain — REFINE | Missing/invalid with Progress fallback; loading/error/retry; unseen without empty-chart wall; fresh/stale trained current rating; selected-window history/accuracy/positive-response/difficulty/activity/game/session facts. `progress-domain-missing/loading/error/unseen/window/summary` | `progress-insights` covers missing target floor/unseen/history/window/slope units; NATIVE_PREVIEW06/07 record corrected0ms display and native limits |
| `progress-game.tsx` Per-game analytics — REFINE | Missing/malformed/no-session target; loading/error/retry; played records/available metric trends; selected window and named90-day All fallback; compact2x records; session links/scroll. `progress-game-loading/error/empty/window/records-layout` | `progress-insights` covers played/window/All/no-session state; records keep version context |
| `rewards.tsx` Rewards — REDESIGN | Loading/error/retry; empty/populated/expanded inbox; claim-one/all busy/success/partial failure; balance; All/Owned/Available; starter/earned/purchased/equipped/locked/insufficient; armed purchase; history/celebration/long scroll. `rewards-loading/error/inbox-empty/inbox-toggle/claim-all/filter-*`, `cosmetic-buy/equip-*`, `rewards-history-empty` | `rewards` covers read/claim/purchase/equip failure, partial durable claim-all, refresh/filter/confirmation/disclosure; DB claim/transaction tests remain separate |
| `data-management.tsx` Data — REBUILD presentation, KEEP engine | Independent counts/backups/stranded-artifact loading/error/retry/empty/populated; optional-name export/result; saved load/share/delete; picker cancel/unavailable; multiline JSON keyboard; invalid/oversized preview; Merge/Replace/loss acknowledgment/withdrawal; exact text/mode/revision invalidation; busy guards; armed/expired confirmation; typed DELETE/export-first/wipe/recovery. `data-counts-*`, `data-export-*`, `data-saved-backups-*`, `data-stranded-*`, `data-import-input`, `data-preview-*`, `data-import-merge/replace`, `data-wipe-*`, operation-local `data-message` |49 data caller and5 confirmation tests; RUNTIME_DATA07 actual native07 export/load/Merge/Replace/edit/restart/SQLite proof. New full-width confirmation geometry requires native09 qualification |
| `storage-unavailable.tsx` Storage recovery — REFINE | Genuine database init failure, selectable detail, readable scrollable steps, Retry and successful return to original route. Direct healthy deep link at624 has false failure copy/no-op Retry: confirmedP2 below. `storage-unavailable`, `*-detail`, `*-retry` | Three `storage-unavailable` tests cover actual startup failure/repeated retry/recovery; direct-route regression is a separate narrow packet |
| `bootstrap-recovery.tsx` Bootstrap recovery — REFINE | Catalog/progression foundational failure with diagnostic/retry/recovery; healthy direct link says Ready to Train with Go to Home. `bootstrap-recovery`, `*-detail`, `*-retry` | `bootstrap-recovery` tests direct fallback/stages/recovery/ancillary preference failure; `bootstrap/run-bootstrap` stage tests |

`prototype.tsx` is a sixteenth source leaf, guarded by `isDevBuild()`.
Production displays that prototype surfaces are dev-only. Its historical076
direction harness is not a shipping journey or another077 art direction.

## Architecture and preserved strengths

- Root `_layout.tsx` owns database→catalog→progression→preferences. Foundational
  failures withhold the normal shell; preference failure uses safe defaults.
  Initial root loading returnsnull and has no root loading testID. Provider-free
  recovery uses static tokens/plain RN, retaining a working retry before DB or
  settings providers exist.
- Root Stack holds pushed routes outside four tabs. `app-tabs.tsx` owns stable
  tab IDs, historical back, safe bottom inset and keyboard-hidden tabs.
  `ScreenShell` owns safe areas, bounded gutters/max width, growing scroll
  content, handled keyboard taps and on-drag keyboard dismissal. Cold deep links
  have explicit fallback destinations where implemented.
- `useDbData` distinguishes pending/success/empty/error, rejects superseded
  reads and clears old payload on parameter changes. Home's workout flow and
  engagement read have separate availability. Hook tests do not automatically
  prove each screen uses the state correctly; the Home bug demonstrates this.
- Generated registry/loaders→validated lazy route→persisted tutorials→GameHost→
  self-contained game→atomic session/rating/economy persistence→durable workout
  CAS preserves deterministic seed/version/launch metadata and semantic IDs.
  Correctness and historical-provenance details remain in the42-game ledgers.
- Pause/tutorial overlays own interaction and hide underlying content from
  accessibility. Pause remains opaque/fair with Resume/Quit. Toasts and earned
  celebrations are nonblocking; destructive confirmation is inline two-tap
  state, distinct from an operating-system picker/share surface.
- `theme/tokens.ts`, `ThemedText`, existing UI controls and `AppIcon` own the
  semantic/domain palette, type/caps/native Android heading metrics, spacing,
  geometry and bounded Lucide imports. Three embedded Manrope files and nine
  literal bundled domain/workout art mappings avoid network dependency.
  `app.json` selects original launcher/adaptive/monochrome/splash/favicon assets.
- KEEP RN Animated press/entrance/progress/reduced-motion behavior where useful;
  gameplay eligibility belongs to observed active clocks, never decorative
  entrance or a visual frame counter. Motion implementation is not a smoothness
  measurement; current performance findings remain open.

## Actionable findings and acceptance boundary

New established source finding: **P2 direct storage-recovery no-op**. Reproduce
with the healthy `/storage-unavailable` route, which receives no bootstrap props.
At624 it advertises a failure/Retry but passes undefined to the action. Root's
real failed-bootstrap caller supplies error and retry and is already tested;
that working failure path must be preserved. Correction follows existing
BootstrapRecovery's honest route-only Home fallback. A separate owned packet
must retain valid before/after real-route evidence; this inventory grants no
native or test PASS before it finishes.

Supporting-route rejected-read caller cases noted in the table are coverage
limits, not proven broken retries. No unsupported source defects or mirrored
tests are invented to erase that distinction. Native keyboard/picker/share,
first-use/tutorial/pause at compact/2x, long-scroll endpoints, transition/motion
and performance acceptance require actual evidence. Root reconciles them with
the corrected-build matrix and selected ARTEMIS journeys. Historical evidence
is not relabeled current simply because a route/component name matches.
