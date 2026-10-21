# Release matrix — Campaign 080

Campaign: `080-native-product-quality`
Authoritative gate record. Each row: requirement → environment → procedure →
revision → result → evidence → limitation.
Results use **PASS / FAIL / BLOCKED / NOT VALIDATED**. Source-test success is
never recorded as native runtime; compilation is never recorded as runtime.

**Revisions:** baseline `f8ae95dd` (origin/main at campaign open); activation
`105ff23b`; qualified implementation `105ff23b+` (governance + QA harness +
reports — **no application source changed** this campaign). Final integrated SHA
is recorded in `handoff.md` / `.agent/STATE.md` after integration (see
`governance.md` H1 self-reference caveat).

---

## A. Native game-catalog coverage

| Gate | Env | Procedure | Rev | Result | Evidence | Limitation |
|---|---|---|---|---|---|---|
| 42-game native smoke (L1) | Android emulator x86_64 | `native-game-sweep.mjs` deep-link + hierarchy + screenshot | 105ff23b+ | **PASS** | `native-coverage-matrix.md`, `qa-artifacts/080/sweep/` | software-rendered emulator |
| Native interaction (L2) | Android emulator x86_64 | sweep driver + improved nested-control pass | 105ff23b+ | **PASS** | 38/42 at L2 | 4 games L1-only (timed/keypad input shapes) |
| Full lifecycle (L3) | Android emulator x86_64 | sweep `--deep-level` session completion | 105ff23b+ | **PARTIAL** | 1/42 at L3 | multi-round session completion automation-limited |
| Coverage ledger matches registry | host | `merge-coverage.mjs` | 105ff23b+ | **PASS** | `native-coverage-merged.json` | — |

## B. Critical journeys

| Gate | Env | Procedure | Rev | Result | Evidence | Limitation |
|---|---|---|---|---|---|---|
| B1 Golden path | emulator | nav + gameplay transitions | 105ff23b+ | **PARTIAL** | `gameplay-regression.md` | fresh first-run onboarding not re-run |
| B2 Pause/Resume/Quit | emulator | timed pause + freeze + resume + quit | 105ff23b+ | **PASS** | `b2-*.png`, gameplay-regression B2 | exercised on Odd One Out |
| B3 Correct/incorrect scoring | emulator + source | genuine correct/incorrect inputs + scoring tests | 105ff23b+ | **PASS** | `b3-*.png`, scoring.test.ts | per-answer truth live on 1 representative game |
| B4 Workout V3 | emulator + source | workout lifecycle | 105ff23b+ | **NOT RE-DRIVEN** | source workout tests | full native workout completion a gap |
| B5 Results/progression | emulator | results + progression read | 105ff23b+ | **PARTIAL** | `b3-session-results.png`, home state | duplicate-reward not re-verified live |
| B6 Offline operation | emulator | airplane cold-start→play→restart→restore | 105ff23b+ | **PASS** | gameplay-regression B6 | — |

## C. Performance

| Gate | Env | Procedure | Rev | Result | Evidence | Limitation |
|---|---|---|---|---|---|---|
| Controlled source benchmarks | host | `npm run perf:probe` (5 probes) | 105ff23b+ | **PASS** | `performance.md` C1 | same-machine comparable, not a gate |
| Emulator vs app overhead separated | emulator | `dumpsys gfxinfo` + GPU percentiles | 105ff23b+ | **PASS** | performance.md C2 | SwiftShader; not physical-representative |
| App-controlled optimization | host/emulator | hot-path profiling + inspection | 105ff23b+ | **NO SAFE TARGET** | performance.md C4 | no confirmed bottleneck cleared the bar; no optimization claimed |
| Memory / leak | host | large-backup probe | 105ff23b+ | **PARTIAL** | performance.md C5 (96MB export heap) | formal leak-instrument run a gap |

## D/E. Visual, accessibility, responsive

| Gate | Env | Procedure | Rev | Result | Evidence | Limitation |
|---|---|---|---|---|---|---|
| Documented P3 reassessment | emulator + source | inspect current state | 105ff23b+ | **PASS** | `visual-accessibility.md` | corrections deferred (prioritization) |
| Semantic a11y labels | emulator | hierarchy content-desc inspection | 105ff23b+ | **PASS** | visual-accessibility E | rich + stable; odd-item label is an accommodation |
| Default-profile layout (42 games) | emulator | sweep render check | 105ff23b+ | **PASS** | native-coverage-matrix | 1080×1920/420dpi |
| Large-font/compact/dark/motion/landscape | emulator | profile matrix | 105ff23b+ | **NOT RE-DRIVEN** | — | gap (sampled in 078/079) |
| TalkBack runtime | emulator | screen-reader interaction | 105ff23b+ | **NOT VALIDATED** | semantic check only | full TalkBack not executed |

## F. Data integrity, persistence, recovery

| Gate | Env | Procedure | Rev | Result | Evidence | Limitation |
|---|---|---|---|---|---|---|
| Data preservation | emulator | non-destructive testing | 105ff23b+ | **PASS** | persistence-offline F1 | owner history preserved |
| Session/progression durability | emulator | offline cold-start + restart | 105ff23b+ | **PASS** | persistence-offline F2 | — |
| Upgrade/install + migration | emulator | install-over + migration | 105ff23b+ | **NOT RE-DRIVEN** | source db tests | gap |
| Backup/restore round-trip | emulator + source | export/import fixtures | 105ff23b+ | **NOT RE-DRIVEN** | source data-portability tests | gap |
| Offline guarantees | emulator | airplane isolation | 105ff23b+ | **PASS** | persistence-offline F4 | — |

## G/H. Platform & governance

| Gate | Env | Procedure | Rev | Result | Evidence | Limitation |
|---|---|---|---|---|---|---|
| Android build | CI + host | Android Build Smoke #448 / assembleRelease | f8ae95dd | **PASS** | run 39553587657 | — |
| Android emulator runtime | emulator | 42-game sweep + journeys | 105ff23b+ | **PASS** | matrix + journeys | x86_64 SwiftShader |
| Android ARM64 runtime | — | ARM64 image / device | — | **NOT VALIDATED** | — | no ARM64 image |
| Android physical runtime | — | physical device | — | **NOT VALIDATED** | — | no device connected |
| iOS compilation | CI macOS | iOS Build Smoke #449 | f8ae95dd | **PASS** | run 39553587616 | compilation ≠ runtime |
| iOS simulator runtime | — | sim boot/install/launch | — | **NOT VALIDATED** | — | lane not established |
| iOS physical runtime | — | physical device | — | **NOT VALIDATED** | — | no device |
| Branch protection / no force-push | GitHub API | read-back protection + ruleset 25523614 | 2026-10-21 | **PASS** | `governance.md` H2 | admin direct-push bypass documented |
| Final-SHA reconciliation | git + API | diff + workflow read-back | f8ae95dd | **PASS** | `governance.md` H1 | app source unchanged 9c4dd138→f8ae95dd |

## Repository gates (hermetic push path)

| Gate | Result | Note |
|---|---|---|
| repo-state-integrity | **PASS** | `validate-repo-state.mjs` — active campaign 080 bound |
| registry-generated-check | **PASS** | game registry unchanged |
| spec-store-generated-check | **PASS** | 142 specs, `--check` clean |
| provenance-drift-check | **PASS** | (re-run at final commit) |
| task-ownership-check | **PASS** | bound to 080 |
| offline-boundary-check | **PASS** | no new network dependency |
| runtime-qa-contract | **PASS** | QA scripts honor the contract |
| validator-cli-contracts | **PASS** | — |
| typecheck (tsc --noEmit) | **PASS** | exit 0 |
| lint (expo lint) | **PASS** | clean |
| test (jest) | **PASS** | full suite green (see `handoff.md` for final count) |
| openspec-validate-strict | **PASS** | 207/207 |
| dependency-audit | see `security.md` | re-run at final commit |

## Verdict basis

No unresolved in-scope P0/P1 defect. P2/P3 items are dispositioned in
`visual-accessibility.md` / `handoff.md`. The release remains **CONDITIONAL** on
external tiers (ARM64, physical Android/iOS, iOS runtime, TalkBack, owner
subjective acceptance), which are **NOT VALIDATED** and not claimed.
