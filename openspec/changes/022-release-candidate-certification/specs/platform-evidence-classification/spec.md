# Platform Evidence Classification — Delta Spec

## ADDED Requirements

### Requirement: Every platform-evidence domain carries one honest classification

Each certification domain (emulator runtime, physical device, TalkBack,
SAF/system sheets, iOS runtime, signing, store submission) MUST be recorded as
exactly one of PASS, FAIL, NOT VALIDATED, DEFERRED, or EXTERNALLY BLOCKED, and
PASS MUST be backed by executed, re-runnable evidence attributed to SHA,
device, and artifact. Static analysis alone MUST NEVER produce PASS for a
runtime or manual domain.

#### Scenario: Manual domain cannot be driven

- GIVEN an autonomous harness cannot drive the Android consent sheet
- WHEN the domain is classified
- THEN the app-side round trip may be PASS while the system-sheet domain is
  NOT VALIDATED with the exact manual steps recorded.

#### Scenario: Absent hardware

- GIVEN no authorized physical device is attached
- WHEN physical-device evidence is classified
- THEN the domain is NOT VALIDATED and executable certification work continues.
