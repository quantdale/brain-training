# Documentation Truth and Cleanup — Delta Spec

## ADDED Requirements

### Requirement: D1 Deferred decisions are tracked truthfully

Password-encrypted backups (constitution §7 "eventually") MUST be recorded as
an explicit deferred decision in `docs/DEFERRED_DECISIONS.md` and as a
DEFERRED row in `docs/PARITY_MATRIX.md`; the misleading `checksum.ts` comment
MUST be corrected. No implementation is added.

#### Scenario: Register consultation

- GIVEN a reader consulting the deferred-decision register
- WHEN they look for backup encryption
- THEN the entry states the deferral, its constitutional basis, and that it
  is not implemented.

### Requirement: D2 Registers and prose describe current reality

KNOWN_ISSUES header contradictions MUST be removed; the DEFERRED_DECISIONS
transport note MUST match the shipped file/share transport; the resolved
export-fusion deferral MUST be recorded as resolved; the constitution status
line and `.agent/GOAL.md` directive history MUST name the active campaign.

#### Scenario: KNOWN_ISSUES status

- GIVEN the KNOWN_ISSUES status paragraph
- WHEN read end to end
- THEN it states one coherent current status with no active-campaign
  contradiction.

### Requirement: D3 Verified-dead files are removed

Files with zero current references (`scripts/qa/release-driver.mjs`,
`apps/mobile/tsconfig.validate.json`) MUST be removed after re-verification;
any retained one-off tool MUST have a live reference.

#### Scenario: Deletion verification

- GIVEN a candidate dead file
- WHEN a whole-repo reference search returns none
- THEN the file is deleted and no doc/workflow/script references it
  afterward.

### Requirement: D4 User-facing copy and roles match the UI

Copy that promises actions the UI does not offer MUST be corrected; the
dialog scrim MUST expose an accessible role; unreachable-variant copy MUST
describe a shipped build rather than a future wave.

#### Scenario: Error-boundary copy

- GIVEN the error boundary renders
- WHEN the user reads the guidance
- THEN every mentioned action exists in the UI.

### Requirement: D5 Every registered game has its unit seams tested

Games whose `hooks.ts` lacks a unit test MUST gain one that asserts the
dev-only guard and the hook's forced-state behavior.

#### Scenario: Hooks coverage sweep

- GIVEN the game catalog
- WHEN hook test files are enumerated
- THEN every game with a `hooks.ts` has a matching test.
