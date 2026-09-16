# Campaign 029 — Runtime and Health Evidence

**Current head:** `13c0e5d85a270edb8e41a676437c6bdf3c81f441`
**Investigation date:** 2026-09-16
**Runtime policy:** Android-first, one dedicated AVD, headless/emulator-local automation only. No host mouse, keyboard injection, foreground hijacking, or desktop coordinate automation was used.

## Evidence labels

- **[Verified by test/CI]** exact command output from this head.
- **[Observed]** direct environment or artifact observation.
- **[Historical]** earlier campaign evidence tied to a different SHA; it is context only.
- **[Not validated]** the requested check did not run to a product conclusion.
- **[Inferred]** source-based hypothesis requiring human/runtime follow-up.

## Current environment and runtime attempt

| Check | Result |
|---|---|
| Repository SHA | **[Observed]** `13c0e5d85a270edb8e41a676437c6bdf3c81f441` |
| Branch/worktree | **[Observed]** `main`, clean before documentation work, tracking `origin/main` |
| ADB inventory before boot | **[Observed]** no attached or running devices (`adb devices -l` listed only the header) |
| Dedicated AVD | **[Observed]** `braintraining-qa36`, initially stopped; existing AVD directory was absent and the harness created it from `system-images;android-35;google_apis;x86_64` |
| Headless boot | **[Not validated]** two attempts; each failed to register with ADB within 60 seconds. The repository script reported emulator 37.1.x intermittent segfault/acceleration/RAM risk. No app launch was reached. |
| QA harness | **[Verified by test/CI]** `QA_OUT=D:\Temp\campaign029\qa-all-blocked node scripts/qa/autobot.mjs --mode all` exited 2 with `blockedReason: no adb device in 'device' state (other=[none])`. |
| QA artifact | **[Observed]** run JSON at `D:\Temp\campaign029\qa-all-blocked\20260916-131132-autobot-all-blocked\run.json`; kept outside the repository and not committed. |

The harness reported **44 not-validated targets**, **0 passed**, and **0 failed**: the 42 catalog games, a dedicated `language-word-match (3.6)` interaction target, and a daily-workout target. This is an environment block, not evidence that those product flows fail.

## Current-head health matrix

| Command | Result at current head | Interpretation |
|---|---|---|
| `node scripts/validate-repo-state.mjs` | PASS; no active campaign; last campaign 028 `VALIDATED` | Governance/state baseline is internally coherent |
| `cd apps/mobile && npm ci --dry-run --ignore-scripts` | PASS, exit 0; lockfile resolution preview completed without installing or changing the worktree | Package lock can be resolved in the current environment |
| `cd apps/mobile && npm run typecheck -- --pretty false` | PASS, exit 0 | TypeScript health is green |
| `cd apps/mobile && npm run lint` | PASS, exit 0 | Lint health is green |
| `cd apps/mobile && npm run test:ci` | PASS; 553 suites passed, 4 skipped; 6,548 tests passed, 5 skipped; 5 snapshots passed; 180.09 s | Current source/test suite is green under the prescribed two-worker command |
| `node scripts/generate-game-registry.mjs --check` | PASS | Generated registry matches 42 game metadata sources |
| `node scripts/validate-provenance.mjs --check --base=origin/main` | PASS; no changed semantic files | No current provenance drift |
| provenance/secret/workflow/ownership self-tests | PASS; provenance 5/5, secrets PASS, workflows 44/44, ownership PASS | Guardrails are operational |
| `node scripts/validate-offline.mjs` | PASS; 970 source files scanned, no network use outside allowlist | Offline source constraint holds |
| `node scripts/validate-affected.mjs --check-sync` | PASS; 15 areas / 43 patterns synchronized | Impact map is synchronized |
| `node scripts/validate-dependency-audit.mjs` | PASS; 5 reviewed accepted advisories, no unallowlisted moderate+ production finding | Current dependency audit policy passes; existing accepted debt remains documented |
| `npx openspec validate --all` | PASS; 15/15 changes | OpenSpec artifacts validate |
| `npx expo-doctor` | FAIL 20/21; 14 SDK-57 packages are one patch behind expected versions | Existing dependency/version drift; deliberately not changed in a docs-only campaign |
| `npx expo export --platform web --output-dir D:\Temp\campaign029\web-export-1 --no-bytecode --max-workers 2` | PASS; 96 files, 20 static routes | Expo can statically bundle the route tree to an external directory; this is not native runtime proof |
| `node scripts/qa/autobot.mjs --self-test` | PASS; 73/73 | QA parser/catalog/report logic is healthy offline |
| `node scripts/qa/autobot.mjs --list-games` | PASS; 42 catalog IDs, eight category canaries | Catalog derivation and canary selection are readable offline |

## GitHub Actions contradiction

**[Verified by test/CI]** GitHub API access was available. All four workflows created at `2026-09-16T12:38:13Z` against the exact current synchronized SHA completed within seconds with `failure` and zero recorded steps:

| Workflow | Run ID | Job | Status/conclusion |
|---|---:|---|---|
| App CI | `35096980170` | Mobile app build/typecheck/tests | completed / failure / 0 steps |
| Repository Integrity | `35096980154` | durable-state | completed / failure / 0 steps |
| Android Build Smoke | `35096980266` | Android clean native build | completed / failure / 0 steps |
| iOS Build Smoke | `35096980141` | iOS Simulator compile smoke | completed / failure / 0 steps |

`gh run view --log-failed` returned no failure log. The same immediate zero-step pattern is present in the preceding 2026-09-14 runs at `609f8ec` (the pre-sync base). **[Inferred]** This is most consistent with a GitHub runner/account/workflow-dispatch infrastructure failure, but the available API does not prove the root cause. It is not classified as an app build failure, and no CI fix was attempted.

## Runtime target matrix

The matrix below is intentionally explicit about what source inspection can and cannot establish.

| Target | Current-head result | Evidence and next validation |
|---|---|---|
| First launch / onboarding | **[Not validated]** | No ready device. Source has no dedicated onboarding route; new-player/empty/tutorial states need a fresh install on a working AVD and a human pass. |
| Returning-user launch / Home | **[Not validated]** | Home source and tests were inspected. A current screenshot, scroll-depth observation, and “what do I tap?” task remain open. |
| Start / resume / configure / reroll workout | **[Not validated]** | Workout engine and QA contracts were inspected; daily target was blocked before launch. Historical workout evidence is listed separately. |
| Games browse/search/filter/favorites/detail | **[Not validated]** | Route source, registry, tests, and web static route were inspected; no current native interaction or touch-density observation. |
| Tutorial / representative gameplay / pause / quit | **[Not validated]** | Eight game modules and shared GameHost were inspected; no gameplay interaction was reached on current head. |
| Per-game result / next-game / workout completion | **[Not validated]** | Results source/tests and workout lifecycle were inspected; current QA all-mode stopped at preflight. |
| Progress overview / domain/game/activity detail | **[Not validated]** | Source and tests were inspected; no current visual density or comprehension observation. |
| Profile / settings / rewards / milestones / data management | **[Not validated]** | Source and route tests were inspected; native scroll and discoverability remain open. |
| Light/dark themes, small/large phone | **[Not validated]** | Tokens and contrast tests passed; no current-head rendered screenshot. |

## Historical runtime evidence (not substituted for current head)

**[Historical]** `.agent/VALIDATION.md` records that Campaign 028’s W6 closure at its then-current SHA validated eight Android canaries, a complete daily workout, relaunch/resume behavior, and accessibility/runtime checks on emulator-5560. The frontier-audit application on 2026-09-14 also recorded a daily workout 4/4 plus relaunch on emulator-5560. Those records establish that the repository has previously supported meaningful runtime QA; they do not establish that `13c0e5d` renders correctly today.

**[Historical]** Earlier Campaign 024–026 visual-QA records and Campaign 025 board-feedback checks are useful for understanding why shared shell, tab labels, GameHost, and token contrast are treated as protected seams. They are not current screenshots and are not used as proof of the current visual diagnosis.

## Runtime limitations and follow-up gate

The following checks must be repeated by the first implementation/usability campaign once a working AVD or physical Android device is available:

1. Clean-install first launch and a returning local profile.
2. Home above-fold comprehension and the exact tap path to Today’s Workout.
3. Full standard workout with one game from each of several interaction families, including tutorial, pause/resume, result, next-game, and completion.
4. Games search/filter/favorite/detail and a known-game return path.
5. Progress summary-to-domain-to-game drill-down.
6. Profile grouping, Rewards claim flow, and Data Management safety copy.
7. Light/dark theme, TalkBack/semantic labels, 44 dp touch targets, and small/large viewport scroll reachability.
8. Screenshot and action-trace artifacts at the exact implementation SHA.

Until then, all visual and usability conclusions in the master plan are explicitly source-based hypotheses, not observed user-test results.
