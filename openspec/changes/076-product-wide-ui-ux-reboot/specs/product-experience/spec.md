## Purpose

Define a coherent, accessible and visibly differentiated experience across every player-facing destination and state of the offline-first training product.

## ADDED Requirements

### Requirement: Action-led navigation
The product SHALL make today's workout, workout continuation, the complete game library, progress, rewards, and profile/settings recognizable and reachable without hiding the primary action behind decorative content. Search, filters and favorites SHALL keep their existing functional meaning and provide understandable empty and reset states.

#### Scenario: First visit and resume
- **WHEN** a new player opens Home or a returning player has an incomplete workout
- **THEN** the respective start or continue action is discernible and operable without first dismissing decorative content, and opening it preserves the correct workout instance and leg.

#### Scenario: Browse and recover
- **WHEN** a player searches or filters Games and obtains no matches
- **THEN** the interface identifies the cause and offers a clear reset or browse-all action without losing the complete catalog.

### Requirement: Complete destination and lifecycle presentation
The product SHALL apply the selected experience system to Home, Games, game detail, tutorials, in-game shell, Results, Progress/insights, Rewards, Profile/settings, workout entry/resume/completion, storage/data management, and loading/empty/error/recovery states. Presentation changes MUST NOT alter stored achievements, scores, currency, workout ownership, backup/restore outcomes, or offline availability.

#### Scenario: Result to next workout leg
- **WHEN** a workout-owned game session is saved successfully
- **THEN** its result communicates the earned outcome and offers the valid next-leg or completion action without implying unpersisted rewards.

#### Scenario: Unavailable local storage
- **WHEN** local storage cannot be opened
- **THEN** the player receives a legible recovery state with relevant available actions and no promise of saved progress.

#### Scenario: Restore and settings
- **WHEN** the player changes a setting or restores local data
- **THEN** the appropriate success, progress, failure or confirmation state remains legible and the existing setting and restore semantics are preserved.

### Requirement: Accessible semantic feedback across themes and sizes
All interactive surfaces SHALL convey state and outcome with text/shape or accessibility semantics in addition to color; support light and dark themes, platform text enlargement, safe areas and reduced motion; preserve meaningful focus and reading order. Text contrast SHALL target at least 4.5:1 for normal text and 3:1 for large text; touch targets SHALL meet the platform's applicable minimum (Android 48dp, iOS 44pt), with exceptions justified in an audited game-specific record.

#### Scenario: Enlarged type on a compact phone
- **WHEN** the player uses 2× text scaling on a compact supported phone
- **THEN** critical instructions and controls remain readable and operable, without clipped labels, invisible actions or content blocked by persistent navigation; scroll is allowed when the primary action remains discoverable.

#### Scenario: Motion and color preferences
- **WHEN** reduced motion is enabled or a player cannot distinguish success and error colors
- **THEN** progression, correctness and exit choices remain comprehensible without animation or color alone, and nonessential motion is suppressed.
