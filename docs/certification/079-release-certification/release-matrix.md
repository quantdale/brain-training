# Release certification matrix — Campaign 079

**Program:** 079-stabilization-acceptance-certification
**Candidate revision:** `9c4dd138cb5cc76e3c2bb76fb8b881d1e8879f0c` (ending
revision of the 2026-10-21 program; any later commit extends this matrix only
through a new dated observation)
**Environment:** Windows 11 host, Node 22.23.2 / npm 10.9.8, JDK 17, Android
SDK 36, dedicated AVD `braintraining-qa36` (x86_64, 1080x1920), GitHub-hosted
`ubuntu-latest` / `macos-latest` runners.
**Verdict vocabulary:** PASS / FAIL / BLOCKED / NOT VALIDATED (source gates)
and GO / CONDITIONAL GO / NO GO / BLOCKED_EXTERNAL / NOT VALIDATED (platforms).

## A. Source and CI gates — all at `9c4dd138` unless noted

| Gate | Requirement | Procedure | Rev | Env | Result | Evidence | Limitation |
|---|---|---|---|---|---|---|---|
| typecheck | `tsc --noEmit` clean | `npm run typecheck` | 9c4dd138 | local + App CI | PASS | App CI run 39547028408 | — |
| test (jest) | full suite green, skips classified | `npm run test:ci` | 0e1c8784 | local | PASS | 711 suites / 8,018 tests / 5 classified skips | app source identical through 9c4dd138 (no src changes) |
| test (jest, CI) | same | App CI jest step | 9c4dd138 | hosted | PASS | run 39547028408 | — |
| lint | `expo lint` clean | `npm run lint` | 0e1c8784 | local + App CI | PASS | App CI run 39547028408 | — |
| web-export-smoke | `npx expo export --platform web` | App CI step | 9c4dd138 | hosted | PASS | run 39547028408 | — |
| repo-state-integrity | `validate-repo-state.mjs` | local + Repository Integrity | 9c4dd138 | local + hosted | PASS | run 39547028373 | — |
| registry-generated-check | `generate-game-registry.mjs --check` | CI + local mirror | 9c4dd138 | local + hosted | PASS | local mirror 23/23 | — |
| spec-store-generated-check | `generate-spec-store.mjs --check` | CI + local | 9c4dd138 | local + hosted | PASS | 141 capabilities, 0 drift | — |
| openspec-validate-strict | `openspec validate --all --strict` | local | 9c4dd138 | local | PASS | 205/205 items | hosted runs the pinned 1.9.0 CLI in Repository Integrity (run 39547028373) |
| provenance-drift-check | `validate-provenance.mjs --check` | local | 9c4dd138 | local | PASS | mirror 23/23 | — |
| task-ownership-check | `validate-task-ownership.cjs` | local + CI | 9c4dd138 | local + hosted | PASS | run 39547028373 | — |
| offline-boundary-check | `validate-offline.mjs --check` | local + CI | 9c4dd138 | local + hosted | PASS | run 39547028408 | — |
| runtime-qa-contract | `qa/validate-runtime-qa-contract.mjs` | local + CI | 9c4dd138 | local + hosted | PASS | run 39547028408 | — |
| secret-boundary-check | `validate-secrets.mjs --check` | local + CI | 9c4dd138 | local + hosted | PASS | run 39547028373 | — |
| workflow-shell-hygiene | `validate-workflows.mjs` | local + CI | 9c4dd138 | local + hosted | PASS | run 39547028373 | — |
| validator-cli-contracts (NEW 079) | documented/parsed/CI flags agree; unknown flags exit 2 | `validate-cli-contracts.mjs` (+ self-test 12/12) | 9c4dd138 | local + hosted | PASS | run 39547028373 | — |
| affected-area-map-sync | `validate-affected.mjs --check-sync` | local + CI | 9c4dd138 | local + hosted | PASS | run 39547028373 | — |
| validator self-tests | each gate's `--self-test` | Repository Integrity step + local mirror | 9c4dd138 | local + hosted | PASS | mirror 23/23 | — |
| expo-alignment (hermetic) | `validate-expo-alignment.mjs` | local + CI | 9c4dd138 | local + hosted | PASS | run 39547028408 | — |
| allowlist freshness | both `--check-allowlist` | Repository Integrity | 9c4dd138 | hosted | PASS | run 39547028373 | scheduled-only by design |
| dependency-audit | policy over `npm audit` | local + Repository Integrity | 9c4dd138 | local + hosted | PASS | 7 accepted GHSAs, 0 unallowlisted (security.md) | network-dependent; exit 2 would be BLOCKED |
| coverage-floors | jest coverage thresholds | weekly schedule | — | hosted | NOT VALIDATED (this program) | run not executed in window | scheduled-only by decision |
| expo-doctor (advisory) | upstream drift signal | weekly schedule | — | hosted | NOT VALIDATED (this program) | 20/21 at 2026-10-21 setup | advisory; never a push-path result |

## B. Build lanes at `9c4dd138`

| Gate | Procedure | Result | Evidence | Limitation |
|---|---|---|---|---|
| Android Build Smoke (clean prebuild + release APK + permission diff) | hosted workflow | PASS | run 39547028543 | x86_64 QA APK built locally separately (below) |
| iOS Build Smoke (prebuild + CocoaPods + simulator compile) | hosted workflow | PASS | run 39547028492 | **compilation only — iOS runtime NOT VALIDATED** |
| Local QA APK (x86_64 release) | `gradlew :app:packageRelease -PreactNativeArchitectures=x86_64` | PASS | sha256 `231559b935b436b10959f0a52098473791bf434682f444c2918c07e552ba48ca`, 52,735,180 B | single-ABI QA artifact; multi-ABI local builds hit the ninja manifest race (see performance.md / KNOWN_ISSUES) |
| APK permission boundary | `aapt2 dump permissions` vs `expected-apk-permissions.txt` | PASS | exact match, 8 entries; RECORD_AUDIO / SYSTEM_ALERT_WINDOW absent | — |

## C. Android emulator runtime (`braintraining-qa36`, APK `231559b9…`)

| Journey | Result | Evidence (local qa-artifacts/, gitignored) | Limitation |
|---|---|---|---|
| Install `-r` over existing data | PASS | install + smoke run `20261021-052945-app-smoke` | owner progress preserved (Level 2 / 198 XP / 39 coins visible on Home) |
| Cold start | PASS | `am start -W`: TotalTime 2887 ms (cold), 2486 ms (force-stopped relaunch) | single samples; not a latency budget |
| Home render + offline affordance | PASS | `home-01.png`, hierarchy dump | — |
| Games discovery (suggested game + reason + favorites + info) | PASS | `079-acceptance-games.png`, `079-ui.xml` | — |
| Game detail (mechanic copy, Play CTA, favorites, empty-state) | PASS | `079-acceptance-detail.png` | — |
| Tutorial intro + interactive demo + success state | PASS | `079-acceptance-tutorial.png`, `079-ui-t2/t3.xml` | — |
| Tutorial → difficulty → Start → active round | PASS | `079-acceptance-round1.png` (Round 1/6, timer, Pause visible) | Start correctly absent while tutorial open |
| Round timeout feedback + Next round advancement (rounds 1→4) | PASS | `079-ui-round1/r2/r3/r4*.xml` | timeout path exercised repeatedly |
| Correct-tap scoring feedback | NOT VALIDATED | — | uiautomator dump latency (~4–5 s) exceeds the ~9–10 s round timer; manual tap path not proven this session (scoring logic unit-covered) |
| Pause/resume/quit | NOT VALIDATED (this session) | — | previously validated in 077/078 native evidence; not re-exercised now |
| Persistence across restart | PASS (indirect) | owner session/economy state intact after `-r` upgrade install | direct SQLite row diff not re-run this session |
| Offline continued play | NOT VALIDATED (this session) | "Ready to play offline." affordance visible | airplane-mode journey not re-run; offline boundary is CI-gated (offline-boundary-check PASS) |
| Background/relaunch | NOT VALIDATED (this session) | — | — |
| Memory / frame behavior | MEASURED | PSS 237,661 KB after journey; 318 frames, 47.48% janky, p50 17 ms / p90 61 ms / p95 101 ms (performance.md) | emulator evidence only; no 60 fps claim |

## D. 42-game coverage disposition

- **Mechanics/scoring/state machines:** 42/42 covered by the automated suite
  (711 suites / 8,018 tests) at `0e1c8784`; app source unchanged through
  `9c4dd138`.
- **Native interactive acceptance this session:** 1/42 games fully journeyed
  (Odd One Out: detail → tutorial → demo → difficulty → round play → timeout
  feedback → advancement). 41/42 NOT re-validated natively this session;
  their native evidence dates from Campaign 077/078 qualification (retained,
  not relabeled).
- **Known open visual P3s (078-era, unchanged):** OddOneOut triangle
  affordance may suggest play; rule-switch timing/watchlist discoverability;
  GridRecall echo scale; ReactionTime depth richness.

## E. Platform release verdicts (H5)

| Dimension | Verdict | Basis |
|---|---|---|
| Source correctness | GO | full matrix green at `9c4dd138` |
| CI (4 workflows) | GO | App CI / Android Build Smoke / iOS Build Smoke / Repository Integrity all success at `9c4dd138` |
| Security | CONDITIONAL GO | policy gate PASS; 7 accepted advisories incl. 1 runtime debt (`decode-uri-component`, expires 2027-03-31) — see security.md |
| Android build | GO | hosted smoke + local QA APK, permission boundary exact |
| Android emulator runtime | CONDITIONAL GO | journeys above; correct-tap/pause/offline re-validation gaps |
| Android physical device | NOT VALIDATED | no hardware available |
| iOS build | GO | compile smoke success |
| iOS simulator runtime | NOT VALIDATED | no macOS runtime harness executed |
| iOS physical device | NOT VALIDATED | no hardware available |
| Accessibility | NOT VALIDATED | static semantics present (labels/hierarchy verified in dumps); no screen-reader automation run |
| Performance | CONDITIONAL GO | measured, emulator-limited (performance.md); no budget violated or claimed |
| Data integrity | GO (bounded) | upgrade-install preservation + unit-covered migrations; no destructive ops performed |
| Product acceptance | CONDITIONAL GO | representative native journeys good; owner taste review pending; exhaustive native matrix incomplete |
| **Overall release status** | **CONDITIONAL GO** | engineering gates complete and green; physical/iOS-runtime/screen-reader certification and owner acceptance are the remaining external gates |
