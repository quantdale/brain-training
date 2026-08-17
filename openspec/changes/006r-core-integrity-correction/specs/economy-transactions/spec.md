# Economy Transactions — Delta Spec

## ADDED Requirements

### Requirement: Spending is balance-safe and atomic
Supported spending commands MUST check the current ledger-derived balance and append the debit in the same transaction. A successful command MUST NOT produce a negative balance.

### Requirement: Streak-item purchase is atomic
A purchase MUST either debit currency and grant the item together or do neither.

### Requirement: Quest/achievement claims are atomic and idempotent
Claim state and all associated XP/currency rewards MUST commit atomically. Repeating the same claim operation after success MUST NOT award twice; retry after an uncertain failure MUST be safe.

### Requirement: Paid reroll is atomic
A paid workout reroll MUST commit debit and new workout reroll state/selection together or neither.

### Requirement: Stable operation identity
Economy/reward operations MUST have stable globally unique IDs or semantic idempotency keys suitable for future cross-device merge. Local autoincrement IDs MAY remain as ordering metadata but MUST NOT be the sole merge identity.

### Requirement: Gameplay reward ownership is unambiguous
The session completion API MUST define one owner of normal gameplay currency. It MUST NOT silently append both a caller-supplied gameplay reward and a rating-service gameplay reward for the same event.

### Requirement: Failure injection
Integration tests MUST inject failures between logical transaction steps and prove rollback/no partial state for purchases, claims, rerolls, and session rewards.