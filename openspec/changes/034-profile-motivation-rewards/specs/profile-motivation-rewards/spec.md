# Profile Motivation and Rewards Ownership

## ADDED Requirements

### Requirement: Profile groups motivation and controls

The Profile overview MUST visibly group local identity, motivation, rewards,
data, and settings so a player can locate each job without scanning a single
undifferentiated inventory.

#### Scenario: Player opens Profile

- **WHEN** a player opens Profile with or without persisted training history
- **THEN** identity and progression context remain visible
- **AND** Motivation, Rewards, Data, and Settings purposes are labeled
- **AND** existing streak protection, data, theme, and sensory controls remain
  reachable.

### Requirement: Rewards is the single claim and cosmetic owner

Profile MUST not present competing first-class claim buttons or a duplicate
full cosmetic catalog. It MUST provide a pending count when derivable from its
loaded state and one route to Rewards.

#### Scenario: Completed motivation objective exists

- **WHEN** an achievement, quest, or streak milestone is complete but unclaimed
- **THEN** Profile describes it as available in Rewards
- **AND** Profile presents no claim write control for that objective
- **AND** the Rewards entry point remains reachable.

### Requirement: Existing Rewards correctness remains intact

The ownership redesign MUST preserve the existing Rewards inbox, claim-all,
claim, cosmetic purchase/equip, reward-history, error, and idempotency paths.

#### Scenario: Player opens Rewards after Profile

- **WHEN** the player activates the Profile Rewards entry
- **THEN** the existing Rewards route opens with its persisted inbox and
  collection state
- **AND** canonical claim writes remain owned by the existing Rewards/reward
  primitives.
