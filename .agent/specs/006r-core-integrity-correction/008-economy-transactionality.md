# 008 — Economy, Purchases, Claims, and Idempotent Transactionality

**Priority:** P2 / integrity-critical  
**Depends on:** 001; integrates with 007  
**Primary surfaces:** DB repositories/services for ledger, streak inventory, quests, achievements, workout rerolls  
**Shared schema/service owner:** orchestrator

## Problems to correct

Several operations currently span multiple independent writes:

- streak-item purchase can debit the ledger and then fail before granting the item;
- quest/achievement claim can mark claimed before reward application completes;
- paid workout reroll can debit before durable reroll state advances;
- UI-level affordability checks can race against another spend;
- local integer AUTOINCREMENT ids are not sufficient future cross-device/idempotency identities.

The append-only ledger itself is a good primitive. This spec turns it into a safe domain transaction boundary.

## Required invariants

1. A successful spend/reward operation commits **all** of its state changes or none.
2. A retry of the same logical operation cannot award/debit twice.
3. Currency balance is derived from the ledger and cannot knowingly become negative through supported spend APIs.
4. UI affordability checks are advisory only; the DB transaction re-checks authoritative balance.
5. Every domain operation has a stable idempotency/source key suitable for retry and future sync.
6. Append-only ledger history remains auditable; no mutable `coins` counter is introduced.

## Stable transaction identity

Introduce a stable globally unique ledger/reward operation identity. Recommended:

- UUID/ULID `operation_id` or `entry_id` stored as TEXT with UNIQUE constraint; and
- semantic idempotency key where natural, e.g.:
  - `session:<sessionId>:gameplay`
  - `quest:<questId>:<period>:reward`
  - `achievement:<achievementId>:reward`
  - `workout:<date>:reroll:<attempt>`
  - `streak-item:<purchaseUuid>`

Keep a local integer sequence only if useful for display/order; it must not be the only merge identity.

Migration must preserve existing ledger entries by assigning deterministic or one-time stable identities without changing amounts/order.

## Required domain services

### A. `spendCurrency` transaction

Provide one supported spending API that:

- begins DB transaction;
- checks whether idempotency key already succeeded;
- reads current ledger-derived balance inside transaction;
- rejects if `balance < cost`;
- appends exactly one negative ledger entry;
- applies associated domain mutation via the same transaction callback/service;
- commits;
- returns new balance + domain result.

Do not expose a generic callback that can mutate arbitrary unrelated tables without control; keep domain services explicit where practical.

### B. Streak-item purchase

Atomically:

- validate price/inventory/monthly caps against current stored settings/state;
- debit currency;
- increment the purchased item/inventory metadata;
- preserve unrelated profile settings;
- return committed inventory + balance.

A failure at any step rolls back both.

### C. Quest claim

Atomically:

- verify quest row/period is complete and not claimed;
- use stable reward idempotency key;
- append XP award exactly once;
- append currency reward exactly once if nonzero;
- mark `claimed_at` only within the same transaction;
- return committed rewards.

If operation is retried after success, return/recognize prior success without duplicating awards.

### D. Achievement claim

Same atomic/idempotent rules as quest claim.

### E. Workout paid reroll

Integrate Spec 007:

- verify current persisted reroll attempt;
- derive cost from persisted attempt, not client-supplied cost;
- verify balance;
- debit with `workout:<date>:reroll:<nextAttempt>` idempotency key;
- persist new deterministic selection/attempt in same transaction;
- return committed workout + balance.

### F. Gameplay completion reward

Review `CompleteSessionInput.currency` plus rating-service gameplay currency behavior. The API currently permits both and can accidentally double-credit.

Choose one explicit ownership rule:

- shared progression engine owns normal gameplay XP/currency; optional caller currency is reserved for a distinct documented external bonus type with its own idempotency key; or
- remove the ambiguous second award path.

Tests must make accidental double award impossible.

## Negative-balance protection

- All supported spend domain operations must use the transactional balance check.
- If legacy code can call `ledger.append({amount: negative})` directly, make that method internal/restricted or clearly unsafe for migrations/tests; application spending must not call it.
- Consider DB-level constraints/trigger if they can safely enforce the invariant without blocking legitimate repair/import operations. Document the choice.

## Required tests

### Failure-injection transaction tests

For each domain operation, inject a failure after every meaningful intermediate step and assert rollback:

- purchase after debit before inventory grant;
- quest after XP insert before currency insert;
- quest after rewards before claim mark;
- reroll after debit before workout update;
- achievement equivalent.

Balance/state before and after failure must be identical.

### Retry/idempotency tests

- invoke each successful operation twice with same idempotency key;
- assert one ledger/reward mutation only;
- result is stable/recognizes prior completion;
- concurrent calls with same key cannot both win.

### Insufficient-funds/race test

Start with balance enough for one of two simultaneous spends. Execute both concurrently/serialized through adapter and prove at most one succeeds and final balance >= 0.

### Migration test

Existing ledger rows migrate with preserved amount/reason/session/time/order and unique stable identities.

## MUST acceptance criteria

- Streak purchase cannot debit without granting.
- Quest/achievement cannot be claimed without the reward committed atomically.
- Paid reroll cannot debit without advancing durable workout state.
- Supported spending APIs cannot produce negative balance through stale UI state/race.
- Stable operation identity/idempotency exists for rewards/spends.
- Gameplay award API cannot accidentally double-credit normal currency.
- Failure injection + retry + concurrency tests pass.
- Full suite/typecheck pass.

## Forbidden shortcuts

- Compensating a failed debit with a later positive ledger entry as the normal transaction model; rollback is required for single-device atomic operations.
- Using only button disabling as a balance guarantee.
- Marking claim first and saying a retry job will eventually pay it without an idempotent transactional design.
- Using current timestamp as the sole idempotency key.
- Replacing append-only ledger with a mutable balance field.