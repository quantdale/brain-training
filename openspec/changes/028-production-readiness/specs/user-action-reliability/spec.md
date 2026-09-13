# User-Action Reliability — Delta Spec

## ADDED Requirements

### Requirement: U1 Failed user actions surface truthfully

Every user-initiated action that can reject (workout start from Home, cosmetic
purchase/equip, milestone/quest/achievement claims) MUST surface the failure
to the user in the same screen and MUST remain safely retryable; console-only
handling is not acceptable.

#### Scenario: Home workout start fails

- GIVEN the Home route with a startable workout template
- WHEN starting the workout rejects
- THEN a danger message is visible, the control re-enables, and the route
  remains on Home with no partial navigation.

#### Scenario: Cosmetic purchase fails

- GIVEN the Rewards route with an affordable cosmetic
- WHEN the purchase rejects
- THEN a danger message is visible and the item remains unowned and retryable.

#### Scenario: Claim fails

- GIVEN the Profile route with a claimable milestone/quest/achievement
- WHEN the claim rejects
- THEN a danger message is visible and the item remains claimable.

### Requirement: U2 Repairs are pinned by regression tests

Each repaired handler MUST have a route-level test that injects the rejection
and asserts the user-visible handling and state consistency.

#### Scenario: Injected rejection

- GIVEN the repaired route under test with the action seam rejecting
- WHEN the user activates the control
- THEN the test observes the failure message and the unchanged domain state.
