# Campaign 041 Mandatory Adversarial Second Pass

The first audit appeared complete only after the core runtime, persistence, and validation evidence existed. This second pass actively tried to disprove it. It was not a summary of the first pass.

| Attack question | Adversarial check | Result / remaining risk |
|---|---|---|
| Are historical PASS labels being reused as current proof? | Reconstructed each 001–040 row, tagged historical claims, and required current test/native/SQLite evidence for current status. | Old labels remain leads only. The ledger marks 10 rows partial and 17 superseded rather than converting all to PASS. |
| Can green tests hide a real native failure? | Replayed fresh install, four-game UI, relaunch, interruption/resume, backup wipe/restore, 42 routes, and eight family interactions. | Core current paths reached real native state. One intermittent workout-load NPE was found and remains open instead of being hidden. |
| Can irreversible writes duplicate under replay? | Repeated current UI transitions and targeted real-DB idempotency/rollback/claim tests; inspected session, rating, ledger, and workout rows. | No duplicate in exercised paths. Distributed sync/physical-device behavior remains outside evidence. |
| Are migrations only tested on happy-path latest schema? | Ran v1..v11 disposable upgrades, negative/future/duplicate guards, populated preservation, integrity/index/trigger checks. | Current migration matrix is strong. Exact historical on-disk fixture coverage remains a bounded gap. |
| Did lifecycle enumeration get mistaken for mechanic coverage? | Corrected three generic detector misses by live control/source inspection and separately performed real wrong/right interaction in all eight families. | 42/42 lifecycle and 8/8 deeper families are distinct claims. No 42-game expert-mechanic claim. |
| Can controls be semantically present but occluded? | Inspected pixels and hierarchy for Home, gameplay, results, backup confirmation, and family controls; reviewed compact/font-scale captures. | No hidden control was proven in representative active paths. Compact/font-scale Home row clipping remains a risk; debug LogBox occlusion contaminated light a11y. |
| Does release secretly need Metro? | Stopped Metro/port 8081, installed release, waited for native startup, inspected pixels and ARTEMIS hierarchy. | Release routes rendered; startup was slow and release XML was blocked. No Metro dependency proven, but production-signed artifact remains pending. |
| Can empty-state UI mask inconsistent stored data? | Compared fresh empty DB, active workout, completed workout, wiped DB, restored DB, and direct SQLite counts. | UI and SQLite agreed in exercised states. No empty-state contradiction found. |
| Are tooling failures being called product failures? | Separated LogBox overlay, UiAutomation registration, and GitHub zero-step failures from app behavior; cross-checked release pixels/ARTEMIS and local builds. | Tooling classifications are bounded. The SQLite NPE is kept as a product reliability observation because logcat showed the app path, despite the missing repro. |
| Are release/security claims stronger than evidence? | Inspected manifest/package, raw npm audit, repo policy audit, QA controls, debug/release behavior, signing/access boundaries. | Release APK is locally debug-signed; raw npm audit exits 1; human/iOS/store/physical checks remain pending. No release certification inflation. |
| Can the final verdict be made green by scope reduction? | Kept all required packet files, reported conditional risks, did not edit workflows or source, and retained the exact conditional verdict. | Evidence supports `CAMPAIGN_041_CONDITIONAL`, not unconditional certification. |

## Second-pass conclusion

`[INFERRED]` The strongest current contradictions are bounded, not catastrophic: one unreproduced SQLite startup failure, large-text/compact clipping risk, a11y/release tooling gaps, raw dependency-audit debt, external zero-step CI, and human/platform boundaries. No unresolved Critical/High current data-loss, session, workout, or exactly-once defect was reproduced. The conditional verdict is intentionally conservative.

