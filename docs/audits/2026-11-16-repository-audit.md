# Repository-wide audit and remediation — 2026-11-16

**Status: IN PROGRESS. Not release or Campaign 080 acceptance.**

The owner explicitly requested exhaustive repository-wide investigation and direct remediation. Goal mode was subsequently deactivated; the owner then explicitly requested resumption, including the interrupted reviewers. This work continues under that ordinary authorization. Unrelated feature development is frozen. Campaign 080 remains the only active top-level campaign.

## Baseline and method

- Fresh `git fetch origin --prune`: clean `main` = `origin/main` = `c4a40bb5997662b494540e52c8d8868876324044`; no stash, other branch, worktree or unpushed commit at entry. All four hosted baseline workflows succeeded.
- Actual installed dependency versions match every present lockfile package (zero mismatches).
- Baseline: TypeScript and whole-package zero-warning ESLint PASS; Jest 731 passed suites / 8,238 passed tests, 4 opt-in suites / 5 classified skipped tests, no failures. All five opted-in performance probes subsequently ran: 5 suites / 22 tests PASS, including 20,000-session backup verification.
- Fresh production dependency gate: 8 previously accepted moderate+ GHSAs, none newly unallowlisted. Full dependency audit additionally reports the Low `deepmerge` GHSA-gcqx-w48m-w2h4; registry latest remains vulnerable 4.3.1. No waiver or blind major override was added. Expo Doctor 20/21 reports ten upstream patch drifts, not a hermetic repository failure.
- Six read-only reviews covered persistence/portability; all 42 game modules; progression/workout/economy/analytics; app/SDK/UI; and scripts/CI/plugins/security/evidence. Their provider quota interruptions were resumed from retained sessions, not restarted. Those reviewers had no execution tool: their proposed counterexamples are hypotheses until separately reproduced below.
- Six isolated implementation worktrees have disjoint ownership; canonical-main/schema/economy/shared-contract integration and runtime QA belong to the parent. Dependency junctions are read-only; no independent dependency installs or emulators.

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

## Remaining audit packets (not yet closed)

- Persistence: final independent calendar/economy review; crash-safe file recovery; actual storage bytes; aggregate write boundaries and malformed nested settings follow-up.
- Game A: Sentence Builder valid alternatives, overdue input and pre-solved case-insensitive scrambles; Number Line timeout error denominator; Deduction Table replay outcomes.
- Game B: duplicate Start delivery, tutorial callback races, adaptive Symbol Tracker reference, continuation ownership, Quick Compare deadline ownership, Order Sweep rapid tutorial picks, Stroop correct-response timing metrics. Vigilance's documented discrimination asymmetry is not a proven defect and will not be speculatively rebalanced.
- App/SDK: live preference hydration after import/wipe; raw-link parser budget; retained workout navigation/focus; async audio failures/disposal; failed lazy import retry; optimistic favorite identity; stranded-file inventory; reduced-motion initialization race.
- Progression: older-workout reconciliation, actual-game provenance validation, skipped/template analytics, continuation identity, lifetime reward XP, chronological reward limits, summary query scope, civil-day Spotlight and duplicate recency ordering.
- Tooling: actual SQLite backup domain; evidence resilience/value/artifact binding; AVD function launch; immutable sweep outputs; version-code domain; range containment; unresolved dependency metadata; malformed Jest counters.

## Runtime and evidence limitations

The dedicated existing AVD initially failed startup: default-port launch reported too many emulator instances despite no listed device; explicit-port launches exited during graphics startup. Supported `-gpu software -feature -Vulkan -no-snapshot` later produced an ADB device at emulator-5570. Full readiness/app/runtime validation remains pending. No user data was reset, no other AVD/process was terminated, and enumeration is not native PASS. External ARTEMIS configuration/provider readiness was checked, but no device journey has yet executed. Physical Android/iOS, screen-reader acceptance, store signing, physical performance and subjective acceptance remain unclaimed.

LSP probes were attempted on changed files. The server did not confirm every clean file; auxiliary generic ast-grep rules also report pre-existing assertions/comments. Neither an empty cache nor an inconclusive LSP probe is counted as clean. TypeScript compiler, ESLint, executable regressions and integration gates remain the authoritative executed source checks.

## Completion gate

Continue reproducing, repairing and independently reviewing until no further reasonable actionable findings remain; rerun full source/generated/spec/security/evidence checks and targeted runtime where feasible, reconcile each finding and remaining risk, publish coherent commits without force, remove session worktrees/junctions, and leave clean pushed main. This report does not currently assert that gate is satisfied.
