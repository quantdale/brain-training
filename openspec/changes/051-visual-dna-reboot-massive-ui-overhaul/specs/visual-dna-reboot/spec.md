# Visual DNA Reboot

## ADDED Requirements

### Requirement: The product has one distinctive, accessible visual identity

The app MUST use a coherent Signal Arcade design system across light and dark
themes. Shared tokens MUST own palette, typography, geometry, depth, spacing,
motion, and sensory rules; screens MUST NOT invent competing one-off systems.

#### Scenario: Theme and large text remain readable

- **WHEN** a user switches light/dark mode or increases system text size
- **THEN** the primary action, navigation, game identity, analytics, and data
  management remain readable, high contrast, and scroll-reachable.

### Requirement: Every catalog game has a recognizable presentation identity

The catalog MUST expose eight domain visual worlds and stable mechanic-family
signatures for all registered games. Decorative art MUST supplement, not
replace, accessible text and stable game IDs.

#### Scenario: The full catalog is browsable offline

- **WHEN** a user searches, filters, favorites, opens detail, or launches any
  registered game without a network
- **THEN** the game remains reachable with its name, domain, mechanic cue, and
  existing SDK/game behavior intact.

### Requirement: Play surfaces prioritize a single next decision

Home, detail, gameplay, and results MUST make the next meaningful action
obvious while analytics and secondary actions remain subordinate.

#### Scenario: A player completes a session

- **WHEN** the result is persisted successfully
- **THEN** the screen presents a bounded completion moment, the authoritative
  reward/progress facts, and one dominant next action without changing the
  workout advancement or persistence contract.

### Requirement: Sensory and accessibility contracts survive the reboot

New motion, haptics, audio, art, and shape treatments MUST respect reduced
motion, user sensory settings, touch targets, accessible labels, and semantic
test IDs.

#### Scenario: Reduced motion and sensory mute are enabled

- **WHEN** a user opens a game, pauses, completes it, or claims a reward
- **THEN** the essential state change remains immediate and understandable,
  decorative movement collapses, and disabled sensory channels emit no effect.
