# Release Readiness Matrix — Delta Spec

## ADDED Requirements

### Requirement: A durable release-readiness matrix with a single verdict exists

The campaign MUST record a durable matrix classifying at minimum: automated
tests, release build, emulator runtime, registry-wide game certification,
Workout V3, lifecycle/process death, real SQLite, migrations, backup/restore,
offline behavior, accessibility, SAF/system sheets, physical device, iOS
compile, iOS runtime, signing, store submission, privacy/data boundary, and
dependency state — each PASS / FAIL / NOT VALIDATED / DEFERRED / EXTERNALLY
BLOCKED — and MUST issue exactly one release verdict (GO, CONDITIONAL GO,
NO-GO) whose justification cites that matrix. "Not tested" MUST NEVER be
collapsed into PASS, and NO-GO MUST be issued while any repository-owned
release blocker remains open.

#### Scenario: Manual certifications outstanding

- GIVEN the implementation is release-candidate quality but store signing,
  TalkBack, SAF sheets, physical-device, and iOS runtime evidence remain
  external/manual
- WHEN the verdict is issued
- THEN it is CONDITIONAL GO with the outstanding certifications listed
  verbatim.

#### Scenario: Repository-owned blocker found

- GIVEN lifecycle testing reproduces duplicate progression writes
- WHEN the verdict is issued before the defect is repaired
- THEN the verdict is NO-GO regardless of green automation.
