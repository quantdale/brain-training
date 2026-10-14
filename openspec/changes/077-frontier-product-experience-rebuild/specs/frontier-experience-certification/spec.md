## Purpose

Prove the complete rebuilt product through fresh visual provenance, independent critique, native runtime and data checks, reproducible engineering gates, and a visible owner handoff.

## ADDED Requirements

### Requirement: Fresh matched visual provenance
Campaign 077 MUST capture its own baseline before modifying affected visual surfaces and compare new emulator screenshots against matched baseline states. Modified major screens MUST be inspected in default light, default dark, 2× font scale, compact, representative larger viewport, and applicable reduced-motion profiles. Requested theme and observed app theme MUST be recorded separately using direct evidence, never brightness inference. Images MUST retain build/APK/device/profile/state/hash provenance.

#### Scenario: Old evidence lacks a theme witness
- **WHEN** a historical capture cannot prove its actual app theme or build applicability
- **THEN** it is not reused as a Campaign 077 matched baseline and missing historical task 14.3 evidence is not fabricated

### Requirement: Independent product-quality critique
Each major implementation wave MUST receive independent read-only design critique against actual screenshots and the reference lock. Clipping, overlap, poor contrast, hidden actions, bad imagery/crops, inconsistent spacing/icons, scroll traps, generic composition, and significant reference drift MUST be corrected before acceptance.

#### Scenario: Automated checks pass but composition remains weak
- **WHEN** the reviewer identifies poor hierarchy, repetitive cards, or unclear game presentation
- **THEN** the screen remains incomplete and the campaign iterates rather than treating rendering or green tests as product acceptance

### Requirement: Native runtime and local-data certification
The campaign MUST verify cold launch without Metro, navigation, themes, gameplay/scored feedback/results, workout continuation, SQLite persistence/integrity, force-stop/relaunch, offline operation, recovery, settings persistence, assets, memory/performance, and logcat errors on the dedicated visible emulator. Existing sessions, progression, workout, migration, backup/export/import/restore compatibility, and permission/security boundaries MUST be protected.

#### Scenario: A workout or restore is interrupted
- **WHEN** the app is stopped and restarted or a recoverable write fails
- **THEN** saved work remains authoritative, recovery is clear and retryable, and data/economy effects are not lost or duplicated

### Requirement: Engineering and ending-SHA certification
Relevant full Jest suites, TypeScript, lint, strict OpenSpec, registry, provenance, dependency/security, permissions, offline, migrations, SQLite, backup/restore, clean-checkout certification, and native Android build MUST pass. App CI, Repository Integrity, Android Build Smoke, and iOS Build Smoke MUST have inspected run IDs and outcomes at the actual ending SHA. Missing or blocked checks MUST NOT be recorded as pass.

#### Scenario: Source changes after a green build
- **WHEN** a repair or final integration changes the certified source
- **THEN** affected checks and artifact provenance are re-established and the final CI claim names the actual published ending SHA

### Requirement: Visible owner handoff and complete report
The completed rebuilt app MUST be installed and foregrounded on Home in a verified visible graphical window for braintraining-ui35. The final report MUST include all fields requested in section 17 of the owner brief, meaningful before/after improvement evidence, remaining limitations, and truthful release verdict. PHYSICAL_ANDROID and IOS_RUNTIME MUST remain NOT VALIDATED unless real evidence is obtained; x86_64 emulation MUST NOT be presented as ARM64/store readiness. Owner approval of taste MUST NOT be claimed without owner review.

#### Scenario: Emulator handoff is ready
- **WHEN** final acceptance is evaluated
- **THEN** window visibility/minimization, AVD/serial, APK hash, package/version, foreground Home, screenshot, clean main, commits/push, final CI, and all campaign requirements are independently evidenced
