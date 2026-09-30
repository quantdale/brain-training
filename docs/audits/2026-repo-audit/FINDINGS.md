# Findings Register — 2026 repository-wide audit

**Audit root:** `docs/audits/2026-repo-audit/`
**Baseline commit:** `2a765cc` on `main`
**Method:** 10 read-only audit lanes (`L01`–`L10`) + orchestrator diagnostics
**Diagnostics run by the orchestrator (all read-only, no source change):**

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` (apps/mobile) | **PASS** (exit 0) |
| Full Jest matrix | `npx jest --ci --maxWorkers=3 --json` | **PASS** — 598 suites (594 passed / 4 pending), 6,933 passed / 5 skipped / 0 failed, 5 snapshots |
| Jest signal integrity | `node scripts/certification/validate-jest-signal.mjs --summary …` | **PASS** — floors 575 suites / 6,840 tests met; 5 classified opt-in skips; 0 unclassified |
| Allowlist freshness (jest) | `… validate-jest-signal.mjs --check-allowlist` | **PASS** — 5 entries, earliest expiry 2027-03-31 |
| Allowlist freshness (provenance) | `node scripts/validate-provenance.mjs --check-allowlist` | **PASS** — 0 entries |
| Opt-in perf probes | `PERF_PROBE=1 LARGE_BACKUP_PROBE=1 npx jest …perf…` | **PASS** — 9 suites / 39 tests (projection, snapshot, sync scans, quest A/B, 20k-session large-backup) |
| Repo state | `node scripts/validate-repo-state.mjs` | **PASS** |
| Offline boundary | `node scripts/validate-offline.mjs` | **PASS** — 985 files, no network APIs outside the allowlist |
| Secrets | `node scripts/validate-secrets.mjs` | **PASS** — 2,722 tracked text files clean |
| Workflow hygiene | `node scripts/validate-workflows.mjs` | **PASS** — 4 workflows |
| Task ownership | `node scripts/validate-task-ownership.cjs` | **PASS** |
| OpenSpec | `openspec validate --all --strict` (pre-audit) | **PASS** — 51/51 |
| **Expo doctor** | `npx expo-doctor` (apps/mobile) | **FAIL — exit 1, 20/21 checks** (see `F-01`) |
| **Dependency audit** | `node scripts/validate-dependency-audit.mjs` | **FAIL — exit 1, 3 unallowlisted `brace-expansion` advisories (2 high)** (see `F-42`) |

**Coverage model.** `apps/mobile/src` = 1,583 TS/TSX files / ~283k lines. Deep lane
coverage: persistence, data portability, SDK/registry, workout, routing, components/theme,
economy, tooling/CI, tests, docs/governance/security. Games (42 modules, ~187k lines)
were covered by orchestrator structural sweeps (per-game module matrix, session
persistence uniformity, timer/cleanup inventory, difficulty-ladder ordering) plus
lane `L03` contract analysis; per-game line-by-line review of all 42 boards was **not**
performed and is recorded as a known coverage boundary.

## Severity summary

| ID | Title | Severity | Confidence | Lane |
|---|---|---|---|---|
| F-01 | Expo doctor CI gate is red on `main` while durable state records 21/21 | **P1** | confirmed | L08/L10 |
| F-42 | Dependency-audit gate is red: 3 unallowlisted `brace-expansion` advisories (2 high DoS); reachable only through build/test toolchain, so the correct disposition is an allowlist entry with reachability evidence, not a version bump | **P1** | confirmed | L10/orch |
| F-43 | CI runs OpenSpec non-strict on a pinned older CLI (1.6.0) while every evidence claim cites `--all --strict` on 1.9.0 | **P2** | confirmed | L08 |
| F-44 | Dependency-audit exit 2 (BLOCKED) is indistinguishable from exit 1 (FAIL) to a bare CI step | **P2** | confirmed | L08 |
| F-45 | Governance prose is incoherent: `CURRENT_CAMPAIGN.md` says ACTIVE while the program is COMPLETE; `STATE.md` says "066 open" then COMPLETE | **P2** | confirmed | L10 |
| F-46 | `docs/MASTER_PLAN.md` is ~40 changes and 17 days stale; its campaign index stops at Campaign 016 | **P1** | confirmed | L10 |
| F-02 | Adapter re-entrancy from a transaction body permanently wedges the app; recorded "fails loudly" classification is false | **P1** | confirmed | L01 |
| F-03 | Test harness is a divergent storage model that hides F-02's whole class | **P1** | confirmed | L01 |
| F-04 | Backup overwrite deletes the destination before the rename (not atomic) | **P2** | confirmed | L02 |
| F-05 | Import validation builds unbounded error strings (memory amplification) | **P2** | confirmed | L02 |
| F-06 | Data Management shows zeroed inventory when reads fail (no error state) | **P2** | confirmed | L05 |
| F-07 | Tab/root navigation uses `push`; the stack grows and back re-enters completed screens | **P2** | strongly indicated | L05 |
| F-08 | `Tappable` spread order discards the merged `accessibilityState` (disabled flag lost) | **P2** | confirmed | L06 |
| F-09 | `memo` is effectively absent from the shared kit; `GameButton`'s memo is inert at ~42% of call sites | **P2** | confirmed | L06 |
| F-10 | `react-native-reanimated` 4.5.1 is a declared runtime dependency with zero imports | **P2** | confirmed | L06/orch |
| F-11 | Two incompatible `MinTouchTarget` exports under one name (number vs style object) | **P2** | confirmed | L06/orch |
| F-12 | `versionToNumber` contradicts its docstring and the SDK's nullable-version contract | **P2** | confirmed | L03 |
| F-13 | `useGameSession.begin()` has no duplicate-start guard; non-terminal sessions are orphaned | **P2** | confirmed | L03 |
| F-14 | Completed workout leg is not advanced durably; no reconciliation exists | **P2** | confirmed (code gap) | L04 |
| F-15 | Home can launch a future leg with its own `legIndex` (false ownership tuple) | **P2** | confirmed | L04 |
| F-16 | Workout has no abandon/skip transition; escape requires paid rerolls | **P2** | confirmed | L04 |
| F-17 | A deadline guard is advertised as a safe-back catalog guard but covers only `games/**` | **P2** | confirmed | L05 |
| F-18 | Design-system and GAME_SDK docs describe superseded generations/modules | **P2** | confirmed | L06 |
| F-19 | Session-lifecycle gate is vacuous (satisfied by host sources, not per game) | **P3** | confirmed | L03 |
| F-20 | 42/42 reducers use `default: return state` as an "exhaustiveness guard" that cannot fail | **P3** | confirmed | orch |
| F-21 | 27/42 reducers assert an unprovable comment over a non-exhaustive switch | **P3** | confirmed | orch |
| F-22 | Profile paints its zeroed fallback as real data (no loading state) | **P3** | confirmed | L05 |
| F-23 | Data Management has no back affordance; the root stack hides all headers | **P3** | confirmed | L05 |
| F-24 | Progress focus reload uses a time-only 5 s window; a mutation inside it stays stale | **P3** | strongly indicated | L05 |
| F-25 | Eight largest route files carry several independent responsibilities | **P3** | confirmed | L05 |
| F-26 | `game-detail` announces "Back to Games" where back does not go to Games | **P3** | confirmed | L05 |
| F-27 | Theme and sensory settings share one context (SFX toggle re-renders everything) | **P3** | strongly indicated | L06 |
| F-28 | Reduced-motion preference starts `false` and is seeded async (first-mount motion can play) | **P3** | strongly indicated | L06 |
| F-29 | Toast visibility is a fixed 2.8 s; overflow silently drops the oldest message | **P3** | confirmed | L06 |
| F-30 | Shared primitives have coverage gaps (Confetti, StateCard, SectionGrid, Toast overflow) | **P3** | confirmed | L06 |
| F-31 | SDK has no behavioral game-module contract; loader is a bare `ComponentType` + unchecked cast | **P2** | confirmed | L03 |
| F-32 | `A11yDialog`/`LiveRegion`/`Avatar`/`ScreenHeader`/`LevelCard`/`StreakCard`/`ResultRow`/`GameCard` have no product importer | **P2** | confirmed | L06 |
| F-33 | `applyReroll` CAS is weaker than `advanceForSession` (no `status='active'`, no shape validation) | **P3** | confirmed (asymmetry) | L04 |
| F-34 | Untracked assistant-config directories in the working tree (hygiene) | **P3** | confirmed | L08 |

**Correction to lane L08.** L08-F05 reported a stray 46-byte root file named `nul`
as pre-existing repository residue. That attribution is wrong: the file was created
during this audit session by a subagent shell command that redirected stderr to `nul`
(a Windows/MSYS redirection artifact), and its contents are a bash error message
(`/usr/bin/bash: line 1: cd: too many arguments`). It was removed and is **not** a
repository defect. The underlying observation about the repo-state validator swallowing
a `stat` failure remains valid, but it is not evidenced by that file.
| F-35 | `initializeConnection` asserts only `foreign_keys`; device has 0 ms busy timeout + rollback journal, test backend 5 s | **P2** | confirmed | L01 |
| F-36 | Schema-guard heal is name-only and trigger-only | **P3** | confirmed | L01 |
| F-37 | Largest production read path exempt from `MAX_READ_LIMIT`; several reads unbounded | **P3** | confirmed | L01 |
| F-38 | Progression sync performs N row writes without a surrounding transaction | **P3** | confirmed | L01 |
| F-39 | Backup from a newer schema imports silently; unknown fields dropped with no signal | **P3** | confirmed | L02 |
| F-40 | A `.`-prefixed / `.tmp` backup name is saved but hidden from listing (unrestorable) | **P3** | confirmed | L02 |
| F-41 | Export never validates its own output against the import contract | **P3** | confirmed | L01 |

## Change partition

| Change | Findings | Priority | Wave |
|---|---|---|---|
| `069-dependency-gate-restoration` | F-01, F-42, F-43, F-44, F-34, F-45, F-46 | P1 | 0 (unblocks green main + restores claim truth) |
| `070-storage-adapter-reentrancy-parity` | F-02, F-03, F-35, F-36, F-37, F-38, F-41 | P1 | 1 |
| `071-backup-transport-atomicity-and-robustness` | F-04, F-05, F-39, F-40 | P2 | 2 |
| `072-shared-ui-contract-integrity` | F-08, F-11, F-18, F-28, F-29, F-30, F-32, F-27, F-09, F-10 | P2 | 2 |
| `073-navigation-state-and-error-surfaces` | F-06, F-07, F-17, F-22, F-23, F-24, F-25, F-26 | P2 | 2 |
| `074-workout-lifecycle-durability` | F-14, F-15, F-16, F-33 | P2 | 2 |
| `075-sdk-module-contract-and-session-safety` | F-12, F-13, F-19, F-31 | P2 | 2 |
| `076-game-reducer-exhaustiveness-enforcement` | F-20, F-21 | P3 | 3 |
