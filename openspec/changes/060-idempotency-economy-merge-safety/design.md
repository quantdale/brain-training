# Design — 060-idempotency-economy-merge-safety

## Ledger race dedupe (`db/ledger.ts`)

```ts
const INSERT_ENTRY =
  'INSERT OR IGNORE INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?, ?, ?, ?, ?)';

// in append(), after the existing pre-check:
const result = await a.run(INSERT_ENTRY, [...]);
if (operationId !== null && result.changes === 0) {
  // Lost a same-key race (or landed after a committed twin): return the
  // winner instead of surfacing a UNIQUE violation (060).
  const winner = await a.get<LedgerRow>(SELECT_BY_OPERATION, [operationId]);
  if (winner) return mapRow(winner);
  throw new Error(`ledger append lost a race with no winner for ${operationId}`);
}
```

In practice `changes === 0` with an operationId means the partial unique
index fired: `append()` pre-validates integers/strings, and genuine
violations (FK, trigger ABORT) still throw through `run`. (OR IGNORE
would also swallow NOT NULL/CHECK, but those cannot reach this
statement.) NULL-operationId appends never hit the branch. The defensive
throw documents the impossible leg.

## Merge-ownership pin + in-txn re-check (`cosmetics/store.ts`)

Sequential merge ownership was already free (fast path); the interleave
(merge between fast-path read and txn) charged. The txn now re-checks
ownership after loading the profile and before the balance check:
owned → `already-owned`, no debit on any path.

In `cosmetics/__tests__/economy.test.ts` (or hardening suite): seed
profile settings with `grantOwned({}, id)` (simulating the merge union),
fund the ledger, no `cosmetic:<id>` entry → expect `already-owned`,
balance unchanged, no new ledger row. Proves the lane-4 refutation
executably. No source change.

## Deliberately unchanged (evidence in proposal)

xpAwards schema (022 + claim gates), merge winner/timestamps/forgery
(single-user semantics), seed migration (accepted LOW).
