# Campaign 067 — terminal ledger

**Program:** `056-067-overnight-autonomous-program` (NIGHT)
**Artifact:** `B7AA4102…` (109,598,109 bytes) — `ARTIFACT.md`
**Verdict:** `PROGRAM_056_067_CERTIFIED`

## Numbered changes

| Change | Verdict | Terminal evidence |
|---|---|---|
| 056 workout-lifecycle-integrity | `CHANGE_056_COMPLETE` | 567 suites / 6,747 tests; adversarial closed |
| 057 result-reward-correctness | `CHANGE_057_COMPLETE` | 569 / 6,810; canary PARTIAL disclosed |
| 058 product-ux-navigation-residuals | `CHANGE_058_COMPLETE` | 571 / 6,818 |
| 059 persistence-transaction-atomicity | `CHANGE_059_COMPLETE` | 572 / 6,825 |
| 060 idempotency-economy-merge-safety | `CHANGE_060_COMPLETE` | 572 / 6,829 |
| 061 performance-lifecycle-cleanup | `CHANGE_061_COMPLETE` | 577 / 6,843 |
| 062 backup-import-export-robustness | `CHANGE_062_COMPLETE` | 577 / 6,847 |
| 063 release-candidate-runtime-matrix | `CAMPAIGN_063_RUNTIME_MATRIX_COMPLETE` | artifact 20e28c64 from e627473 |
| 064 dependency-security-validation-gates | `CHANGE_064_COMPLETE` | 583 / 6,854; gates hardened |
| 065 adversarial-convergence-runtime-data-pixel | `CHANGE_065_COMPLETE` | 588 / 6,893; bounded device pass |
| 066 adversarial-convergence-static-governance | `CHANGE_066_COMPLETE` | 589 / 6,900; census + preconditions |
| 067 terminal whole-product certification | `CHANGE_067_COMPLETE` | this ledger |

## Certification status by area

| Area | Status |
|---|---|
| Artifact identity (hash/size/package/signing/bundle/markers/permissions) | **CERTIFIED** |
| Startup matrix (clean install, 5 launches incl. offline, 0 ANR) | **CERTIFIED** |
| Route + recovery matrix (6 routes + 4 recovery probes) | **CERTIFIED** |
| Provider open/cancel (share sheet, Files picker) | **CERTIFIED** |
| Completion persistence (weak path) + relaunch retention | **CERTIFIED** |
| SQLite integrity/FK/schema/duplicates | **CERTIFIED** |
| Log review (5,180 lines, 0 fatal/ANR/SQLite/RedBox) | **CERTIFIED** |
| Canonical six-way pixel matrix (11 surfaces × 3 profiles × 2 themes) | **CERTIFIED — 66/66 PASS** (`PIXEL_A11Y_MATRIX.md`) |
| A11y audit (per profile) | **CERTIFIED with a hardening correction** — 0 unlabelled interactive nodes; 4 Progress period tabs were TRUE 32 dp targets (initially misclassified as hit-slop-compliant) and were repaired in the hardening phase (`minHeight` 44 + layout pin); the remaining flags were occlusion false positives (audit tool fixed). See `PIXEL_A11Y_MATRIX.md` |
| Interaction captures for 42 games × six-way | **NOT VALIDATED** — canonical set + representative interaction only; expansion recorded (census C2) |
| Crafted replace-import via UI apply | **NOT VALIDATED (device UI)** — the two-tap `ConfirmButton` contract (arm + confirm within 4 s) requires a human/ARTEMIS journey; unit tests and the 065 DB-level device probe prove the path |
| Mid/strong results, workout-leg journey, soak, cold boot | **NOT VALIDATED** — hardening phase |
| Human TalkBack/VoiceOver | **MANUAL** |
| iOS / physical / OEM devices | **EXTERNAL** |
| Store signing / store install path | **MANUAL / EXTERNAL** |
| External CI / GitHub account policy / branch protection | **EXTERNAL** |

## Repository-owned defect count

- Critical: **0**
- High: **0**
- Medium: **0 open** (all Medium findings from 056–066 were repaired or accepted with explicit rationale; accepted items are product decisions, not defects)
- Low: recorded in `.agent/BACKLOG.md`/`KNOWN_ISSUES.md` with owners

## Post-067 hardening artifact (Phase 2 delta)

The hardening phase (Pass A/B/C) changed product source after
certification. Verified hardening build:

```
SHA256: 146F63BF42886CEC34C4B86DBD6085CA7BD60B53FE2514A08EC23B7D9DEEE127
bytes:  109,602,821
```

Device proofs on that build: cold deep link → game → pause → Quit lands
on **Games** (the 42-screen exit fix); fresh Progress capture audits **0
a11y violations** (the 44 dp tab fix); launch 1,487 ms with 0 fatal/ANR.
This build is the current verified executable; a future release
certification must re-issue the 067 matrix on a build from the hardening
tree.

## Post-067 hardening baseline

`docs/redesign/evidence/campaign066/RESIDUAL_CENSUS.md` (Pass A/B/C)
plus the 067 NOT-VALIDATED lanes above; evidence root
`docs/hardening/post067/` (wave-1 fixes, convergence log, and closure).
