# Campaign 055 — Final Repository Validation

Run on the frozen Campaign 055 tree (`main`, after all implementation and
convergence edits) on the dedicated host. Exact commands, exit codes and
observed output.

| Gate | Command | Result |
| --- | --- | --- |
| Full Jest (gated, authoritative) | `npx jest --ci --maxWorkers=2` | **PASS** — 565 passed suites, 4 skipped suites; **6,731 passed tests**, 5 skipped; 5 snapshots passed; 0 unexpected console output. (Campaign 054 baseline was 564 suites / 6,726 tests; this campaign added suite(s) and tests — see reconciliation below.) |
| Typecheck | `npx tsc --noEmit` | **PASS** (no errors) |
| Lint | `npx expo lint` | **PASS** — 0 errors, 0 warnings after convergence cleanup |
| Repository state | `node scripts/validate-repo-state.mjs` | **PASS** — active campaign `055-signal-arcade-desirability` |
| Task ownership | `node scripts/validate-task-ownership.cjs` | **PASS** |
| Affected map sync | `node scripts/validate-affected.mjs --check-sync` | **PASS** — 16 areas, 46 patterns |
| Registry | `node scripts/generate-game-registry.mjs --check` | **PASS** — generated registry up to date (42 games unchanged) |
| Provenance | `node scripts/validate-provenance.mjs` | **PASS** — no drift |
| Offline | `node scripts/validate-offline.mjs` | **PASS** — 983 files scanned, CLEAN |
| Secrets | `node scripts/validate-secrets.mjs` | **PASS** — 2,511 tracked text files CLEAN |
| Workflow hygiene | `node scripts/validate-workflows.mjs` | **PASS** — 4 files |
| Dependency audit policy | `node scripts/validate-dependency-audit.mjs` | **PASS** — accepted dispositions unchanged |
| Runtime QA contract | `node scripts/qa/validate-runtime-qa-contract.mjs` | **PASS** |
| Expo Doctor | `npx expo-doctor` | **PASS** — 21/21 checks |
| OpenSpec strict | `openspec validate --all --strict` | **PASS** — 39/39 items (includes the new `055-signal-arcade-desirability` change) |
| Opt-in probes (5/5) | `PERF_PROBE=1 LARGE_BACKUP_PROBE=1 npx jest <five probe files>` | **PASS** — 5 suites / 22 tests |
| Web export | `npx expo export --platform web` | **PASS** — all routes exported to `dist` (the non-fatal "Something prevented Expo from exiting" notice is the known CLI shutdown quirk; the export completed) |
| Android debug build | `.\gradlew :app:assembleDebug --no-daemon` | see `ANDROID_BUILDS` section below |
| Android release build | `.\gradlew :app:assembleRelease --no-daemon` | **BUILD SUCCESSFUL** — final APK SHA-256 `9E6B94FCED9A70DDBE828C99734D846DF7A1DB4ED5F42B3FFDC6691A236A367A`, 109,593,933 bytes (debug-signed local artifact, not a store artifact) |

## Validation-count reconciliation

- Campaign 054 terminal: 564 suites / 6,726 tests / 5 snapshots.
- Campaign 055 terminal: **565 suites / 6,731 tests / 5 snapshots** (4 suites /
  5 tests classified opt-in skips; 0 unexpected console output).
- Delta: +1 suite and +5 tests — the new
  `components/shell/__tests__/format.test.ts` cases for `playerFacingReason`
  (3 tests) plus the new
  `components/discovery/__tests__/suggested-next.test.tsx` suite. The single
  committed snapshot was intentionally re-baselined once for the visual
  restyle (Home/Games/Progress/Profile/tabs first-run states) and still
  contains 5 snapshots. No test was deleted or weakened; two suites
  (`game-detail`, `game-host`) updated two style assertions from the legacy
  Card hero tokens (`surfaceRaised`/no border) to the new Stage role
  (`surface`/hairline border) with the neutral-surface intent preserved.

## Protected-floor checks

- Unexpected-console gate: empty baseline holds (the gated full run reports no
  unexpected console output).
- Opt-in probes: 5/5 executed and passing.
- 42-game registry: unchanged and provably generated (`--check` clean).
- Bootstrap recovery, route envelope, session/workout identity, reward/currency
  idempotency, backup/import/export, offline, schema v12: untouched by this
  campaign; their suites remain green in the full run and the native checks in
  `FINAL_NATIVE_VALIDATION.md`.
- `apps/mobile/src/games/**` changes in this campaign are display-only
  (rounded millisecond text, one removed duplicate result row); no mechanic,
  scoring, timer, generator, difficulty or registry path changed.

---

# Resumption addendum (2026-09-20) — repository matrix on the frozen source

Run on the frozen product-source checkpoint
`ddfe539d1a25b5bf47b2b3975ee37783e0f81f60` (working tree clean for
`apps/mobile/src` at every gate). Exact commands, exit codes and observed
counts.

| Gate | Command | Result |
| --- | --- | --- |
| Full Jest (gated, authoritative) | `npx jest --ci --maxWorkers=2` | **PASS** — 565 passed suites, 4 skipped; **6,731 passed tests**, 5 skipped; 5 snapshots; 0 unexpected console output (204 s) |
| Typecheck | `npx tsc --noEmit` | **PASS** (no errors) |
| Lint | `npx expo lint` | **PASS** — 0 errors, 0 warnings |
| Expo Doctor | `npx expo-doctor` | **PASS** — 21/21 checks |
| OpenSpec strict | `openspec validate --all --strict` | **PASS** — 39/39 items |
| Repository state | `node scripts/validate-repo-state.mjs` | **PASS** — active campaign `055-signal-arcade-desirability` |
| Task ownership | `node scripts/validate-task-ownership.cjs` | **PASS** |
| Affected map sync | `node scripts/validate-affected.mjs --check-sync` | **PASS** — 16 areas, 46 patterns |
| Registry | `node scripts/generate-game-registry.mjs --check` | **PASS** — generated registry up to date (42 games) |
| Provenance | `node scripts/validate-provenance.mjs` | **PASS** — no drift |
| Offline | `node scripts/validate-offline.mjs` | **PASS** — 983 files scanned, CLEAN |
| Secrets | `node scripts/validate-secrets.mjs` | **PASS** — 2,527 tracked text files CLEAN |
| Workflow hygiene | `node scripts/validate-workflows.mjs` | **PASS** — 4 files |
| Dependency audit policy | `node scripts/validate-dependency-audit.mjs` | **PASS** — 4 accepted advisories, no unallowlisted findings |
| Runtime QA contract | `node scripts/qa/validate-runtime-qa-contract.mjs` | **PASS** |
| Opt-in probes (5/5) | `PERF_PROBE=1 LARGE_BACKUP_PROBE=1 npx jest <five probe suites>` | **PASS** — 5 suites / 22 tests (29 s) |
| Web export | `npx expo export --platform web` | **PASS** — all routes exported to `dist` |
| Android debug build | `.\gradlew :app:assembleDebug --no-daemon` | **BUILD SUCCESSFUL** (2 m 26 s) |
| Android release build | `.\gradlew :app:assembleRelease --no-daemon` | **BUILD SUCCESSFUL** (2 m 49 s) — final APK SHA-256 `A83729AEFC9C00D398A215880CFB5B6837A3F08CA248EEC770BAAF2D33C48AA5`, 109,596,169 bytes |

## Validation-count reconciliation

- Campaign 055 first session: 565 suites / 6,731 tests / 5 snapshots.
- Resumption: **565 suites / 6,731 tests / 5 snapshots** — the display-only
  closure changed no suite or test count. The 19 game suites whose assertions
  referenced the removed duplicate `Score` row were migrated deliberately: the
  obsolete results-row assertion was deleted where the focal `score-final`
  assertion on the adjacent line already proves the score is on screen, and six
  end-to-end score-text assertions were re-pointed from the removed fact row to
  the focal numeral (`score-final`). No test was weakened, skipped or deleted.

## Protected-floor checks

- Unexpected-console gate: empty baseline holds (0 unexpected output in the
  gated run).
- 42-game registry: unchanged and generated (`--check` clean).
- `apps/mobile/src/games/**` changes are display-only: one removed duplicate
  fact row in 27 games, one band prop in 42 games, two exceptional-title
  fall-throughs, and deliberate test migrations; no mechanic, scoring, timer,
  generator, difficulty or registry path changed.
- Bootstrap recovery, route envelope, session/workout identity,
  reward/currency idempotency, backup/import/export, offline, schema v12:
  untouched by the display changes; their suites are green in the full run and
  the native workout/SQLite evidence is in `FINAL_NATIVE_VALIDATION.md`.
