# Tasks — Campaign 022 Release-Candidate Certification

Campaign status: **VALIDATED**. A checked item means the required work or honest evidence classification was completed; it does not mean an unavailable external/manual gate was converted into PASS. Exact evidence lives in `.agent/VALIDATION.md`.

## 1. Debt triage and disposition

- [x] 1.1 `xp_awards` idempotency: full write-path/adversarial audit completed; proposed `UNIQUE(source)` reclassified as incorrect/non-blocking because generic/system sources legitimately repeat, while production award writers remain serialized/CAS guarded and ledger operations have their own uniqueness authority.
- [x] 1.2 Offline validator heuristic gap classified against runtime evidence and retained as Low/non-blocking maintenance.
- [x] 1.3 Provenance-allowlist dead entries, seeding mock seam, and QA artifact retention classified and documented as non-blocking maintenance.

## 2. Release artifact

- [x] 2.1 Clean dependency/install/doctor candidate preparation completed.
- [x] 2.2 Clean Expo prebuild + release Gradle APK assembly completed; unavailable store-signing/AAB evidence classified honestly rather than fabricated.
- [x] 2.3 Artifact inspection completed: hash/size/version/SDK/permissions/ABIs/debug/signing classification recorded.

## 3. Standalone runtime certification

- [x] 3.1 Release artifact installed from clean state and proven standalone without Metro.
- [x] 3.2 Broad registry certification completed: 42/42 game certification PASS after defects found by the release/certify path were fixed and re-run.
- [x] 3.3 Workout V3 runtime certification completed and recorded.
- [x] 3.4 Lifecycle/process-death/duplicate-write/stale-state certification completed and recorded.
- [x] 3.5 Cold-relaunch persistence and reinstall-boundary behavior classified with observed evidence.

## 4. Data integrity certification

- [x] 4.1 Real-SQLite integrity/invariant/migration/soak evidence completed and recorded.
- [x] 4.2 Backup/export/restore and adversarial portability evidence completed to the executable host boundary and recorded.

## 5. Platform evidence

- [x] 5.1 Accessibility tree automated evidence completed; manual TalkBack remains NOT VALIDATED/DEFERRED.
- [x] 5.2 App-side SAF/data-portability path classified; manual system sheets remain NOT VALIDATED.
- [x] 5.3 Physical Android device classified NOT VALIDATED when authorized hardware was unavailable.
- [x] 5.4 Performance/runtime-soak evidence completed and recorded.
- [x] 5.5 Offline proof completed on the executable Android path.
- [x] 5.6 Security/privacy/package/log/export/secret evidence completed and recorded.
- [x] 5.7 iOS compile/source compatibility retained; manual/runtime UX classified NOT VALIDATED without the required macOS/iOS environment.

## 6. Convergence and verdict

- [x] 6.1 Full final regression matrix completed and recorded.
- [x] 6.2 Final workflow evidence/run IDs recorded on the terminal evidence chain.
- [x] 6.3 Release-readiness matrix and **CONDITIONAL GO** verdict recorded; durable terminal state reconciled; no repository-owned release blocker remains.
