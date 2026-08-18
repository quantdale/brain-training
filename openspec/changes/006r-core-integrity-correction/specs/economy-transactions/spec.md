# Economy Transactions — Delta Spec

## ADDED Requirements

### Requirement: Spending is balance-safe and atomic
Supported spending commands MUST check the current ledger-derived balance and append the debit in the same transaction. A successful command MUST NOT produce a negative balance.

#### Scenario: Debit checked in same transaction
- GIVEN a current ledger-derived balance
- WHEN a spending command executes
- THEN it verifies balance and appends the debit in one transaction and never leaves a negative balance.

### Requirement: Streak-item purchase is atomic
A purchase MUST either debit currency and grant the item together or do neither.

#### Scenario: Purchase all-or-nothing
- GIVEN sufficient currency for a streak item
- WHEN the purchase executes
- THEN currency is debited and the item granted together, or neither occurs.

### Requirement: Quest/achievement claims are atomic and idempotent
Claim state and all associated XP/currency rewards MUST commit atomically. Repeating the same claim operation after success MUST NOT award twice; retry after an uncertain failure MUST be safe.

#### Scenario: Repeated claim awards once
- GIVEN a successfully claimed quest
- WHEN the same claim operation repeats
- THEN rewards are not awarded twice and a retry after uncertain failure is safe.

### Requirement: Paid reroll is atomic
A paid workout reroll MUST commit debit and new workout reroll state/selection together or neither.

#### Scenario: Reroll debit and state together
- GIVEN a paid reroll is requested
- WHEN it commits
- THEN the currency debit and new reroll state/selection commit together or neither commits.

### Requirement: Stable operation identity
Economy/reward operations MUST have stable globally unique IDs or semantic idempotency keys suitable for future cross-device merge. Local autoincrement IDs MAY remain as ordering metadata but MUST NOT be the sole merge identity.

#### Scenario: Operation carries stable idempotency key
- GIVEN an economy/reward operation
- WHEN it is recorded for future cross-device merge
- THEN it carries a stable global ID or semantic idempotency key rather than relying solely on a local autoincrement ID.

### Requirement: Gameplay reward ownership is unambiguous
The session completion API MUST define one owner of normal gameplay currency. It MUST NOT silently append both a caller-supplied gameplay reward and a rating-service gameplay reward for the same event.

#### Scenario: Single currency owner per event
- GIVEN a normal gameplay session completion
- WHEN the completion API resolves currency
- THEN exactly one owner awards the gameplay currency and no duplicate caller-supplied plus rating-service reward is appended.

### Requirement: Failure injection
Integration tests MUST inject failures between logical transaction steps and prove rollback/no partial state for purchases, claims, rerolls, and session rewards.

#### Scenario: Injected failure yields no partial state
- GIVEN integration tests for purchases, claims, rerolls, and session rewards
- WHEN a failure is injected between logical transaction steps
- THEN the system rolls back and shows no partial state.