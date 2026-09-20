# Spec — idempotency-economy-merge-safety

## ADDED Requirements

### Requirement: Same-operationId appends dedupe on all paths

`ledger.append` with an `operationId` SHALL return the single committed
entry whether the duplicate arrives sequentially or interleaved: keep the
pre-check fast path; on a unique-conflict insert (`changes === 0`),
reselect by `operationId` and return the winner. A UNIQUE throw SHALL
never surface for operationId duplicates.

#### Scenario: Interleaved duplicates dedupe

- GIVEN no entry under `op:race`
- WHEN two overlapping appends race under `op:race`
- THEN one row exists; both callers receive the same entry; neither
  throws.

#### Scenario: Sequential duplicates still dedupe

- GIVEN an entry committed under `op:seq`
- WHEN appending again under `op:seq`
- THEN the original entry returns; no second row.

### Requirement: Merge-owned cosmetics are never charged

Purchasing a cosmetic whose ownership comes from a backup merge union
(settings flag present, no ledger entry) SHALL return `already-owned`
with the balance untouched.

#### Scenario: Merge ownership is free

- GIVEN settings union-own `cosmetic:x`, no `cosmetic:x` ledger entry, a
  funded balance
- WHEN purchasing `x`
- THEN `already-owned`; balance unchanged; no ledger row added.

## MODIFIED Requirements

None. Behavior only gains the race-dedupe branch.

## REMOVED Requirements

None.
