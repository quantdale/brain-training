# First-Run Trust

## ADDED Requirements

### Requirement: Clean-install training is locally legible

The clean-install Home surface MUST make the primary training action and the
device-local/offline nature of the product understandable without an account
or network explanation elsewhere.

#### Scenario: New player opens Home

- **WHEN** the local catalog and today's workout are initialized
- **THEN** Today's Workout and its existing Start workout action remain in the
  first-run hero
- **AND** a compact secondary line states that training is ready on the device
  and works offline
- **AND** no account gate, forced permission, or marketing step is inserted.

### Requirement: Seeded local setup is not presented as absent data

Data Management MUST distinguish an unavailable storage-size metric from an
empty local setup using the count snapshot it already loaded.

#### Scenario: Fresh store has initialized local state

- **WHEN** the storage backend reports zero/unknown bytes but a local profile,
  workout, quest, or other initialized row exists
- **THEN** the hero reports the local store as ready rather than empty
- **AND** the existing exact local counts and destructive-action safeguards
  remain unchanged.

### Requirement: Starter cosmetics are explained honestly

Rewards MUST explain that the default-owned cosmetics are included in the
starter set when showing collection progress on a clean install.

#### Scenario: New player opens Rewards

- **WHEN** the inbox is empty and default cosmetics are owned
- **THEN** the collection progress remains truthful
- **AND** supporting copy says the starter set is included and describes the
  existing earned-currency path for additional safe cosmetics.

### Requirement: First-run clarity does not fabricate progression

The first-run treatment MUST NOT create sessions, ratings, XP, coins, rewards,
favorites, or history merely to make empty surfaces look populated.

#### Scenario: New player inspects empty surfaces

- **WHEN** no game session has been recorded
- **THEN** Progress, Game Detail, Rewards inbox, Favorites, and history retain
  their honest no-history states and existing actions.
