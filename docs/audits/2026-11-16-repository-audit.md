# Repository-wide audit and remediation — 2026-11-16

**Status: source remediation qualified; native validation BLOCKED. Not exhaustive runtime, release or Campaign 080 acceptance.**

The owner explicitly requested exhaustive repository-wide investigation and direct remediation. Goal mode was subsequently deactivated; the owner then explicitly requested resumption, including the interrupted reviewers. This work continues under that ordinary authorization. Unrelated feature development is frozen. Campaign 080 remains the only active top-level campaign.

## Baseline and method

- Fresh `git fetch origin --prune`: clean `main` = `origin/main` = `c4a40bb5997662b494540e52c8d8868876324044`; no stash, other branch, worktree or unpushed commit at entry. All four hosted baseline workflows succeeded.
- Actual installed dependency versions match every present lockfile package (zero mismatches).
- Baseline: TypeScript and whole-package zero-warning ESLint PASS; Jest 731 passed suites / 8,238 passed tests, 4 opt-in suites / 5 classified skipped tests, no failures. All five opted-in performance probes subsequently ran: 5 suites / 22 tests PASS, including 20,000-session backup verification.
- Fresh production dependency gate: 8 previously accepted moderate+ GHSAs, none newly unallowlisted. Full dependency audit additionally reports the Low `deepmerge` GHSA-gcqx-w48m-w2h4; registry latest remains vulnerable 4.3.1. No waiver or blind major override was added. Expo Doctor 20/21 reports ten upstream patch drifts, not a hermetic repository failure.
- Six read-only reviews covered persistence/portability; all 42 game modules; progression/workout/economy/analytics; app/SDK/UI; and scripts/CI/plugins/security/evidence. Their provider quota interruptions were resumed from retained sessions, not restarted. Those reviewers had no execution tool: their proposed counterexamples are hypotheses until separately reproduced below.
- Six isolated implementation worktrees had disjoint ownership; canonical-main/schema/economy/shared-contract integration and runtime QA belonged to the parent. All six were verified clean/patch-equivalent, dependency junctions safely unlinked, and worktrees removed through Git. No independent dependency installs or emulators; only the canonical worktree remains.

Retained session evidence: `D:/Documents/tryPython/_AgentArtifacts/brain-training/sessions/20261116-pi-repo-audit/`. Initial malformed Jest invocation is retained as an invocation failure, not red behavioral proof. The valid checksum red run is `legacy-checksum-red02.log`.

## Reproduced and repaired in the initial persistence wave

| ID | Defect and root correction | Verification |
|---|---|---|
| D00 | Engine-1 backups with integer-like object keys fail checksum validation because streaming lexical key order differs from the old stringify numeric-key order. Import now recognizes the original checksum only for original/absent engine metadata; current export bytes remain unchanged. Corrected the inaccurate parity comments. | Real old-algorithm checksummed fixtures failed before (2 failures / 2 controls). Import → replace → current export and corruption/modern-format negative controls pass; focused 3 suites / 19 tests. |
| D01 | Generic identical XP awards/unkeyed ledger occurrences were collapsed against the growing import target, silently dropping legitimate amounts. Match against pre-import occurrence counts instead; reimport remains idempotent. | Real database assertions reproduced 10→5 XP/currency loss; multiplicity and repeat-import assertions now pass. |
| D02 | An upgraded `gameplay:<session>` key did not match the identical restored unkeyed legacy reward, double-crediting currency. Bridge known canonical gameplay identities to equivalent historical rows, without mutating the append-only ledger. | Both import orders and repeated merge tested; legacy-first reproduced balance 20 instead of 10 before repair. |
| D04 | Individually safe integers could overflow SQLite sums or combined JavaScript XP after import. Validate actual deduplicated post-import currency/session-XP/award-XP totals within the transaction; reject unsafe sums without floating-point substitution. | 1,025 MAX_SAFE_INTEGER session rows, combined XP boundary, and currency boundary: preview and real replace reject; original data remains intact. |
| D06 | Two valid divergent spending histories merged to a negative balance. Reject the conflicting merge before commit; do not clamp or fabricate currency. Replace retains its historical-data preservation semantics. | Shared +100 credit and distinct −80 spends reproduced accepted −60 merge; preview and apply now reject and preserve original balance 20/rows. |
| D07 | Null/string/array incoming streak settings erased monotonic claims and covered days. Normalize each recognized settings block independently before merging. | All three malformed-block counterexamples failed before and now preserve the device claims, covered dates, inventory and monthly-use record. |
| D10 | Internal NUL-delimited composite keys collide when valid input strings contain NUL, dropping distinct rewards. Use structural JSON tuples for internal identities. | Distinct achievement source/reason tuples reproduced two rows collapsing to one; both now survive. |

Combined adversarial import regression: **11 genuine failures / 1 control before**, **12/12 PASS after**. Complete current portability suite after initial repairs: **21 passed suites / 248 passed tests**, one explicitly opt-in measurement skipped in that run (it was executed in the separate performance matrix). Typecheck and scoped lint passed for the checksum repair; final whole-tree gates follow integration.

Unkeyed legacy records have no globally stable identity. The compatible multiset merge preserves maximum observed multiplicity and repeat-import idempotency; it cannot prove whether indistinguishable independently created records across devices are one event or two. No fictitious identity is introduced.

## Calendar attribution and bootstrap repair (implemented)

Schema 14 adds `game_sessions.completed_local_date` and its index. Normal
completion records the device-local day; imports preserve it; older rows/backups
infer it once at migration/import. Historical timezone cannot be recovered and
is not fabricated. Original timestamps and old normalized scores are unchanged.
Quest period membership/catch-up, streak activity, local daily SQL counts and
calendar/consistency/breadth/volume projections use that fixed day. Unsupported
four-digit-calendar timestamps are rejected before new completion/import; old
corrupt samples remain stored but cannot crash period catch-up. Lifetime-XP
quests include awarded XP, matching profile/achievement totals.

The calendar regression initially failed six cases; after the repair the wider
integration found four exact-shape tests that needed the explicit additional
calendar field. Those were extended without relaxing their equality checks.
Final calendar/persistence/progression/analytics/quest/streak integration:
**74 suites / 934 tests PASS**, 2 opt-in measurement tests skipped; current
TypeScript and scoped zero-warning ESLint PASS. This includes an actual recurring
quest claim followed by rejection of a second-day claim from the same sessions,
legacy migration replay, backup round-trip, malformed timestamps/bootstrap, and
lifetime reward-XP progress.

## Integrated repair waves and independent follow-up

All six initial repair packets and the progression/settings follow-ups are now integrated into canonical main; worker evidence is retained separately, not summed into a whole-app test count.

| Area | Integrated correction and executed evidence |
|---|---|
| Persistence/recovery | Complete-backup format/checksum validation before recovery cleanup; preserve recovery copies on short writes; actual SQLite page storage metrics (`96f7cd37`). Original compatibility/economy repairs remain above. |
| Games | Sentence alternatives/deadlines/unsolved scramble fallback; exact Deduction outcomes; Number Line submitted-sample denominator (`c1813a4f`). Duplicate Start/Next/tutorial ownership, Tracker reference provenance, Compare equality and correct-only Stroop timings (`e5fb5be3`). Independent source review accepts the bounded game snapshot after independently designed probes14/14 and ten actual-call-site suites80/80 passed by parent execution. No native acceptance inferred. |
| App/SDK | Retained workout navigation/focus, async audio disposal/failures, lazy-import retry, favorite identity and reduced-motion races (`e835af2a`); result identity (`bf824014`); stranded inventory (`10faef56`); live preference hydration/write barrier (`b5e5fc72`); pre-parser native-intent budgets (`d2235190`). |
| Progression | Reconcile all active workouts and scope summary evidence (`f5461735`); actual played/template/skip analytics, civil-day Spotlight and repeated-game recency (`f6208327`); chronological reward limits (`0c7e6a3b`). Schema15 adds matching event-time/lexical-id indexes, verified by actual SQLite query plans and migration replay. Completion rejects provenance naming a different physical game. |
| Tooling/evidence | Correct SQLite backup-exclusion domain and bounded version encoding (`bba91065`); fail-closed launch/output/alignment/dependency/Jest gates (`d9f62b99`); hierarchy-bound causality and unsupported resilience refusal (`e7b9a99e`). Producer now uses strict XML/entity decoding and the same value projection, with a hierarchy artifact for every observation. |

Independent DATA review initially **REJECTED** four further edge cases: one target ledger occurrence could match both incoming keyed and unkeyed rows; malformed nested freezeUsed could reopen monthly caps; a valid foreign civil date skipped by the current timezone could throw; accepted year0100 could produce unpadded period keys. These are repaired with shared physical-row allocation, validated nested usage, padded civil-key arithmetic and civil-date quest-selection/evaluation APIs (no current-zone instant reconstruction). The unchanged independent probes subsequently **ACCEPT R1–R4**. Permanent scoped integration:103 suites/1,253 tests PASS; explicit Pacific/Apia/accepted-year/calendar22/22 PASS. Original red logs remain.

That reviewer then proved **R5/R6**, normal-write overflow after a valid MAX_SAFE import: two ordinary +1 awards/credits make SQLite's exact total9007199254740993 appear as9007199254740992 through JS projections, and the app's own export becomes unrestorable. A single unsafe XP award was also accepted. New statement-local INSERT predicates atomically bound combined session+award XP and currency, preserving concurrent standalone writes and idempotent retries without nested transactions or clamping. Permanent preservation regression: 8 failures/one control before, 9/9 PASS after. Independent unchanged preservation replay 9/9 and related plus seven adversarial edge probes 117/117 PASS; **ACCEPT R5/R6**. These include signed lower bounds, explicit transaction rollback, rating-owned rewards, shared-file connections and idempotency at the ceiling.

Independent APP review reproduced a post-commit hydration-read failure that incorrectly reported import failure and reopened stale sibling-setting writes. Follow-up `cc141c4e` retains a provider-owned latch and exposes read-only recovery on Data Management/Profile, without repeating import/wipe. Canonical hydration/preference/bounds 17 tests PASS; independent exact-diff source re-review **ACCEPTS** this correction with parent-execution limitations explicit. The original verbatim probe and its behavioral red are retained.

Independent TOOLING review found optional screenshot-only observations poisoned all capability re-derivation through a schema-invalid null hierarchyArtifact, and immediate emulator crashes bypassed the explicit retry budget. Both permanent regressions failed before; CLI/sweep/AVD integration88/88 PASS after. The independently designed parent-executed probe retains forgery FAIL, missing-endpoint BLOCKED and unsupported-resilience ATTEMPTED while accepting the unchanged legitimate journey plus an unused optional capture. Independent bounded source re-review **ACCEPTS** both fixes after inspecting the parent-executed red/green receipts.

Stroop's persisted avgResponseTimeMs was also absent from both analytics field maps. The mean-preference regression failed800→200 before; JS/SQL differential fixtures now include mean and null-fallback cases. No old normalized score is recomputed.

A final explicit UTC replay exposed a pre-epoch subsecond blind spot: SQLite integer division truncated -1 ms toward zero, moving legacy attribution into the next day. `5150e90e` uses real division for migration and read-time local/UTC fallbacks. The original independent UTC counterexample failed before and passes after; permanent migration/fallback/projection regressions pass. No already-attributed day or original instant is rewritten.

## Hosted Node22 regression and test-clock correction

Published checkpoint `f0ae74b0` passed Android Build Smoke43874862394, iOS Build
Smoke43874862479 and push Repository Integrity43874862682. App CI43874862401
failed nine tests: seven preference cases plus two downstream cleanup hooks.
Scheduled Integrity43878406454 passed durable-state but reproduced the seven
preference failures even at its90s coverage timeout; increasing timeouts is not
a repair. Original logs/JSON remain under `hosted-App-CI-f0ae74b0-*` and
`hosted-Integrity-extra-f0ae74b0-failed.log`.

A bounded actual Node22 replay exposed rendered-tree clock/async-act coordination.
The two new route suites switched from Router's fake clock mid-tree, then polled
SQLite with async `waitFor` predicates. Retaining Router's clock removes the first
stall; an explicitly awaited no-op preference-writer sentinel replaces only the
async database polling, retaining every exact assertion. The bare no-root async-
wait probe passes, so this is not claimed as a universal upstream defect. Source
inspection finds no recursive production profile read; timeout contamination is
consistent with the hosted stack overflow, not proof of a product recursion bug.
No product code, dependency, skip, assertion or timeout was changed by this repair.

Independent source review accepts the exact test diff after inspecting the parent-
executed independently designed cold-cache Node22 replay:2 suites/7 tests PASS,
process exit0 (`ci-preference-sentinel-node22-cold03.*`). Node24 all four previously
failed suites:4/21 PASS/exit0 (`ci-sentinel-node24-scope03.*`). Full Node22 coverage
then passed755 suites/8,467 tests and all configured floors at the unchanged15s
per-test timeout (`ci-node22-coverage-final.*`); five exact opt-in skips classify
successfully. Reviewer-local execution remains NOT VALIDATED. Fresh exact-ending
hosted confirmation is still a post-push delivery gate, not inferred here.

## Final local source qualification

Code-bearing application checkpoint `5150e90e`; subsequent `83f13907` is shell formatting only, with the two test-only coordination corrections described above. All figures are executed receipts, not sums of overlapping worker suites.

| Gate | Result / retained evidence |
|---|---|
| Whole Jest / critical-tree coverage | **PASS on Node22: 755 suites / 8,467 tests**, all configured coverage floors, unchanged15s timeout, five classified opt-in skips, zero failures; `ci-node22-coverage-final.json/.log/.exit`, `ci-node22-jest-signal-final.json`. Earlier Node24 full matrix remains in `final-source-jest-subsecond.*`. |
| Deterministic Node tooling | **329/329 PASS**, no skips; `node-full-final-subsecond.log/.exit`. |
| TypeScript / whole-package ESLint | **PASS, zero warnings**; repeated after the CI-test correction (`ci-repair-types.log`, `ci-repair-lint.log`). LSP coverage remains inconclusive, not falsely clean. |
| Hermetic repo/generated/security/contracts | **PASS**: repo state, registry, 142 generated specs, actual-baseline provenance, task ownership, offline, secrets, workflow hygiene, affected-map sync, Expo alignment, CLI/runtime contracts and clean-checkout self-test. `hermetic-convergence04.log`, `final-postcommit-gates01.log`; these do not claim an actual independent clean install. |
| Validator self-tests / freshness | **PASS**, `validator-self-tests-final01.log`; strict OpenSpec **207/207 PASS** (`openspec-final01.log`). |
| Production dependency gate | **PASS with eight existing accepted advisories**, not zero vulnerabilities (`dependency-audit-final01.log`). No package/lockfile upgrades. |
| Web production export | **PASS: 23 routes**, `web-export-final02.log/.exit`; existing local-CSS-font warnings retained. |
| Five opt-in scale probes | **PASS**, 22 probe tests; expanded correctness/probe convergence 10 suites/71 tests. `perf-current02-cache.log`; 20k-session backup verifies, not a physical-device test. |
| Independent follow-ups | DATA R1–R6 and evaluation cache accepted within replayed scopes. GAME, APP and TOOLING source reviewers accept their bounded fixes after inspecting parent-executed independently designed probes; no invented reviewer-local execution. Reports under `independent-data-review/`, and retained Pi reviewer outputs. |
| Native build lanes | At published `f0ae74b0`, hosted Android clean build **PASS** and iOS Simulator compile plus20s process-alive smoke **PASS** (Debug without Metro, not gameplay). Local prebuild PASS; local Gradle **TIMEOUT after1,100s** remains retained, not relabeled successful. `android-current-prebuild.log`, `android-current-release.log`. Exact ending-SHA lanes require fresh hosted observation. |
| Android runtime / physical platforms | **NOT VALIDATED / BLOCKED**: no ready emulator guest; no current-build gameplay journey, physical performance, comprehensive screen-reader or signing/owner acceptance. |
| Exact published-SHA CI / cleanup | `f0ae74b0` results and test-only repair are detailed above; exact ending-SHA confirmation is reported after push in the external session handoff. All six integrated session worktrees/junctions are removed; no abandoned branch/worktree. |

Earlier failures remain unchanged: whole integration01 had 744 passed suites/8,382 passed tests and two obsolete shape/async expectations; integration02 had 754 passed suites/8,464 passed tests and one error-wording mismatch. They were corrected without disabling tests; later complete matrices, not those failures, establish the final result.

Measured quest-period work was also addressed, not speculatively optimized: five sample rows initially triggered **65** calendar resolutions per batch. An evaluation-local lazy cache reduces this to five, with no cross-call timezone cache. At the 5k scan cap, in-process evaluation measured **48.45→8.11 ms**, full sync **139.27→70.59 ms** on this host. Independent uncached-oracle/batch/individual/mutation tests pass **27/27 in UTC and 27/27 in actual Pacific/Apia**. These are local microbenchmarks, not native FPS, latency or a causal physical performance claim.

## Bounded residual risks
- Backup recovery has a conditional stronger-fault limitation: if the filesystem writes an ENTIRELY DIFFERENT checksum-valid backup, the first exact copy check retains .prev, but a later sweep cannot distinguish that valid wrong live file without a persistent expected-content journal. Independent review classifies this low-priority fault-model debt; ordinary truncation/ENOSPC/caught-write/restart controls pass and no native occurrence is established. Its counterexample remains retained, not relabeled repaired.
- Conservative rejection of signed64 intermediate SUM overflow is intentional: even a mathematically safe final sum in that row order is unusable by normal SQLite balance readers. Unidentified legacy-event ambiguity and historical timezone irrecoverability remain as documented above.
- Vigilance's documented false-alarm asymmetry is not a proven defect; no speculative rebalance. Existing low-priority duplicated score/contrast/taste debt, accepted dependency advisories and upstream patch drift are not hidden.

## Runtime and evidence limitations

The dedicated existing AVD initially failed startup: default-port launch reported too many emulator instances despite no listed device; explicit-port launches exited during graphics startup. Supported `-gpu software -feature -Vulkan -no-snapshot` later produced an ADB device at emulator-5570. The transport later went offline; scoped shell/console requests hung. Session-owned hung launcher/qemu processes were stopped without wipe or snapshot manipulation. Supported SwiftShader/no-Wifi/no-Vulkan and no-GPU follow-ups did not establish a responsive guest shell or completed boot. A final TCG/no-GPU isolation probe exited 0xC0000005 without boot; no host hypervisor/driver changes were attempted. Full readiness/app/runtime validation is BLOCKED. No user data was reset, no other AVD/process was terminated, and enumeration is not native PASS. Final ARTEMIS doctor passed credential/tooling/config checks but warned on Android readiness; no device journey executed. Physical Android/iOS, screen-reader acceptance, store signing, physical performance and subjective acceptance remain unclaimed.

LSP probes were attempted on changed files. The server did not confirm every clean file; auxiliary generic ast-grep rules also report pre-existing assertions/comments. Neither an empty cache nor an inconclusive LSP probe is counted as clean. TypeScript compiler, ESLint, executable regressions and integration gates remain the authoritative executed source checks.

## Completion gate

Reproduced source findings in the reviewed packets are repaired, regression-tested and independently dispositioned. The hosted test-clock regression has a bounded accepted test-only correction and a passing full Node22 coverage replay. Remaining native gameplay acceptance is a genuine environment blocker, not a source pass. The source-qualified recovery checkpoint may be published under the documented native-unavailable governance exception after green local source gates; exact ending-SHA hosted results and clean main are checked afterward and retained in the external session handoff. All six integrated session worktrees/junctions are removed. Campaign080 stays ACTIVE for current-build runtime/physical/owner obligations. No exhaustive runtime or release-completion claim is made.
