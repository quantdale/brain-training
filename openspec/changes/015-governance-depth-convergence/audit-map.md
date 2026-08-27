# Audit Map — Campaign 015

Original baseline: `c8acadceb46ad6ba3f90b0c4222583a9a2912f49`  
Current-head re-audit: `366a098527876e2c4c7448526bcdebcb686a59c6` (`.agent/CAMPAIGN015_REAUDIT_2026-08-27.md`)

| ID | Current evidence | Classification | Normative spec | Primary tasks |
|---|---|---|---|---|
| G-01 | Governance names Campaign 014 but no matching OpenSpec change exists | confirmed governance false-green | `campaign-governance` | 1.1–1.6 |
| G-02 | repo-state validates OpenSpec only if expected directory exists; missing-dir error special-cases 006R | confirmed validator defect | `campaign-governance` | 1.2–1.4 |
| G-03 | task-ownership JSON still declares 006R and historical `src/**` paths | confirmed stale gate | `campaign-governance` | 2.1–2.7 |
| G-04 | STATE header says 014 active while later sections say 013 authoritative / still needs closure | confirmed contradictory recovery state | `repository-state-integrity` | 3.1–3.5 |
| G-05 | affected-area tool prints risk plan but current subsystem coverage is incomplete | validation gap | `repository-state-integrity` | 3.6–3.9 |
| H-01 | root tracks zero-byte `'` and `i.startsWith('home')` | confirmed hygiene defect | `repository-state-integrity` | 4.1–4.3 |
| H-02 | README/BACKLOG still say Workout V2 while 014 records Workout V3 | predecessor docs debt | activation requirement | 0.1–0.6 |
| H-03 | 006R metadata/task evidence not fully reconciled | historical state drift | `repository-state-integrity` | 4.4 |
| D-01 | Rule Grid generator blanks one Latin-square cell; difficulty mainly size/round/time | confirmed depth defect | `game-depth-convergence` | 5.1–5.9 |
| D-02 | Word Chain pack declares 30 total chains | confirmed content starvation | `game-depth-convergence` | 6.1–6.7 |
| D-03 | Context Fit pack declares 60 total items | confirmed content starvation | `game-depth-convergence` | 7.1–7.8 |
| D-04 | Transform Match bounded fallbacks can bypass stated invariants; 014 records hidden-source ambiguity | confirmed invariant/semantic risk | `game-depth-convergence` | 8.1–8.9 |
| R-01 | 014 did not rerun opt-in timing probes | evidence gap | `runtime-evidence` | 9.1–9.6 |
| R-02 | dedicated AVD dropped offline before required 014 Workout V3/canary journeys | predecessor validation gap | activation requirement | 0.1–0.6 |
| A-01 | changed visual/puzzle surfaces require targeted semantic verification | validation gap | `runtime-evidence` | 10.1–10.5 |

| W-01 | App CI run 33051125658 fails 2 workout routing tests on current HEAD; Repository Integrity still passes | confirmed red-main correctness defect | `workout-integrity` | P0.1–P0.9, 8A.1–8A.7 |
| W-02 | completion routing uses duplicated 10s timestamp tolerance; equal/recent historical sessions become eligible | confirmed unsafe heuristic | `workout-integrity` | P0.2–P0.7, 8A |
| W-03 | persisted `GameSessionRecord` carries no workout-instance identity; results infer owner by game/time/most-recent active instance | confirmed attribution ambiguity | `workout-integrity` | P0.3–P0.6, 8A |
| G-06 | STATE labels already-pushed Aug-27 repair as working/unpushed and points at older campaign SHA | confirmed durable-state freshness drift | `repository-state-integrity` | P0.9, 3.1–3.5 |
| T-01 | current Jest summary has 4 skipped suites / 5 skipped tests plus overlapping-act warning noise | validation/test-truthfulness gap | `runtime-evidence` / repo integrity | 4A.1–4A.5 |
| T-02 | five app tab screens contain ~120 KB orchestration with no co-located direct tests | targeted integration opportunity, not blanket coverage defect | `runtime-evidence` | 4A.3 |
| Q-01 | root zero-byte artifacts remain present at current HEAD | confirmed unresolved hygiene defect | `repository-state-integrity` | 4.1–4.3 |

## Evidence handling rule

A row in this map is planning evidence, not proof of task completion. Before
editing a subsystem, re-read current source because Campaign 014 may advance
between this proposal commit and Campaign 015 activation.

If current code has already repaired an item, close the task by proving the
normative requirement against current behavior rather than reimplementing it.
