# Accessibility, device, motion, and sensory hardening

## ADDED Requirements

### Requirement: Tested accessible conditions preserve operability

The product MUST preserve labelled primary actions, readable state meaning, and
reachable scroll content for the Android accessibility/device conditions that
are actually tested in the campaign evidence.

#### Scenario: A high-value screen is captured under a tested condition

- **WHEN** Home, Games, Progress, Profile, Rewards, Data Management, Game
  Detail, or a representative GameHost state is captured under the recorded
  theme/font/viewport/motion condition
- **THEN** its primary action and semantic route/state evidence remain
  observable, or the evidence records a truthful PARTIAL/BLOCKED result.

### Requirement: Existing sensory settings remain truthful

The product MUST keep SFX and haptics controls connected to the existing
persisted settings/provider seam; the campaign MUST NOT add a non-functional
music or accessibility control.

#### Scenario: Sensory controls are disabled

- **WHEN** a tested user disables SFX or haptics
- **THEN** the visible switch and persisted setting reflect the disabled state
  after the supported relaunch path, without changing gameplay/session data.

### Requirement: No unsupported platform claims

Campaign evidence MUST distinguish automated Android checks from manual
TalkBack, VoiceOver, iOS, physical-device, and human validation.

#### Scenario: A platform condition is unavailable

- **WHEN** a manual or platform runtime cannot be executed
- **THEN** the evidence labels it NOT VALIDATED or BLOCKED and does not infer
  success from source, snapshots, or another platform.
