# Campaign 032 discovery validation

## Automated product coverage

- Games library, Game Detail, and identity tests: **PASS**, 3 suites / 15
  tests.
- Favorites, mastery engine/pushdown, registry, content registry/integrity,
  and SDK catalog membership/uniqueness/contracts: **PASS**, 12 suites / 319
  tests.
- Representative family screen suites: **PASS**, 8 suites / 82 tests.
- Full CI-mode Jest: **PASS**, 555 passed suites / 559 total (4 intentional
  opt-in suites skipped); 6,557 passed tests / 6,562 total (5 intentional
  opt-in tests skipped); 5 snapshots passed; 0 failures.
- Fresh JSON signal validation against
  `D:\Temp\campaign032-jest-summary.json`: **PASS**, 5 classified skips,
  0 unclassified, 0 ambiguous, 0 unexpected warnings.

## State matrix

| State | Evidence | Result |
| --- | --- | --- |
| Default Games | `D:\Temp\campaign032-runtime-after\default\{light,dark}\games.{png,xml}` | Suggested Next is present; Browse All is reachable; default catalog count is 42 |
| Suggested Next populated | same Games XML plus `games-suggested-next`, `games-suggested-primary`, and `games-suggested-reason` | Existing evidence produced a deterministic Card Sort recommendation with an undertrained Flexibility reason |
| Search active | `D:\Temp\campaign032-runtime-after\games-search-memory.png` / XML | Recommendation is hidden; Memory query shows `Showing 7 of 42 games`; clear control is present |
| Category filter | `D:\Temp\campaign032-runtime-after\games-filter-language.png` | Language selection shows 5 of 42 and only Language cards |
| Favorites populated | `D:\Temp\campaign032-runtime-after\games-favorites-populated.png` and `game-detail-language-favorite.png` | Context Fit was favorited, returned through Favorites, and displayed as one catalog result |
| Favorites empty | `D:\Temp\campaign032-runtime-after\games-favorites-empty.png` | Clean relaunch with no active category/filter shows `games-favorites-empty`, “No favorites yet”, and Browse all games recovery |
| No results | `D:\Temp\campaign032-runtime-after\no-results.png` / XML | Query `zzz` shows `games-no-results`, `Showing 0 of 42 games`, and Clear filters |
| Reset | Games library tests and native filter/search journey | Reset clears query/category/favorites state and restores the default browse model |
| Offline | `node scripts/validate-offline.mjs --check` plus Games offline caption/source path | **PASS/CLEAN**; discovery reads remain local and no network API was introduced |

## Native representative identity routes

The eight route captures under
`D:\Temp\campaign032-runtime-after\representatives\` each contain a
non-empty PNG and UIAutomator XML with `game-detail-title`,
`game-detail-identity-verb`, and `game-detail-play`:

| Family | ID | Title / verb observed |
| --- | --- | --- |
| Attention / visual search | `attention-visual-search` | Visual Search / Find |
| Memory / recall | `memory-prospective-cue` | Cue Keeper / Remember |
| Speed / reaction timing | `speed-reaction-time` | Reaction Time / React |
| Math / structured input | `math-equation-builder` | Equation Builder / Build |
| Language / context | `language-context-fit` | Context Fit / Connect |
| Logic / deduction | `logic-deduction-table` | Deduction Table / Infer |
| Flexibility / rule switching | `flexibility-task-switch` | Task Switch / Alternate |
| Spatial / transformation | `spatial-transform-match` | Transform Match / Transform |

All eight standalone detail entries loaded on the disposable AVD. Existing
tutorial/session behavior was covered by the full test matrix and the
standalone intro captures; no game mechanic was altered to obtain the route
evidence.

