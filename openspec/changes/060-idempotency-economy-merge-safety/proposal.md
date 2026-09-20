# Change 060 — Idempotency, Economy & Merge Safety

**Status:** IN_PROGRESS
**Predecessor:** `059-persistence-transaction-atomicity` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 059–061 structural quality and deep invariants.

## Problem / evidence

Verified against source at `09b9af9`. Four census claims were CLOSED by
design evidence during verification (recorded so they stay closed):

- **xpAwards double-award: no live path (reaffirms Campaign 022).** Every
  production award commits inside one serialized txn behind a CAS claim
  gate (`quests/rewards.ts:60-102`, `achievements/rewards.ts:54-85`);
  retry-after-commit returns `already-claimed` without reaching `award`
  (pinned by `claim-hardening.test.ts` concurrent/duplicate tests). The
  022 "no blanket UNIQUE(source)" decision stands: `system` sources
  legitimately repeat in tests/restore semantics.
- **purchaseCosmetic merge double-charge: sequential path safe, race fixed.**
  The fast path returns `already-owned` for settings-owned items, and the
  in-txn branch grants-without-charge when a ledger entry exists — but a
  merge landing *between* the fast-path read and the txn charged for
  merge-owned items (no ledger entry to dedupe on). Closed by an in-txn
  ownership re-check before the balance check, plus sequential + forced-
  interleave pinning tests.
- **Workout merge `updatedAt` trust: single-user restore semantics.** The
  row-atomic newer-wins rule plus preview gating is the correct semantic
  for self-owned backups; "attacks" are self-forgery with no cross-user
  effect. Accepted (no change).
- **Backup timestamps / forged progression: accepted.** Strict
  future-rejection would break legit skewed-clock restores; gameId
  membership rejection would break retired-game restores; authenticity
  (MAC/encryption) is constitution-deferred. Shape/range/FK validation
  stays as the boundary. Accepted (no change).
- **Seed FNV: accepted LOW.** Runtime RNG consumes exact strings
  (`createRng(action.seed)`); `rawResult.seed` preserves the original
  string per row; the INTEGER column is a fingerprint (+ legacy compat),
  never a replay source. A v13 `seed_text` migration buys query
  convenience at big-table migration risk — disproportionate. Accepted
  (no change; deferred from 057 explicitly here).

Real gap fixed here:

1. **Ledger operationId race throws (MEDIUM).** `append` checks-then-
inserts; two interleaved appends under one `operationId` hit the partial
unique index and the loser throws instead of deduping. Retried
spend/claim surfaces an error rather than idempotent success. (Expo
queue serializes today, so latent — but the contract promises dedupe.)
Fix: `INSERT OR IGNORE` + reselect (pre-validation keeps every other
violation loud).

## Desired invariant / outcome

- Concurrent same-`operationId` appends resolve to the single committed
  entry on all paths (pre-check fast path + `INSERT OR IGNORE` +
  reselect), never a UNIQUE throw. Sequential behavior byte-identical.
- Merge-owned cosmetics provably never charged (test).
- No schema change, no economy-formula change, no merge-semantic change,
  no migration.

## Non-goals

- xpAwards schema, merge winner rules, timestamp bounds, backup
  authenticity, seed migration (all closed/accepted above with evidence).

## Affected areas

`db/ledger.ts` (OR IGNORE + reselect), `cosmetics/__tests__` (merge-
ownership pin), `db/__tests__` (race test).

## Protected contracts

Partial unique index semantics, claim-gate atomicity, operationId
dedupe expectations in economy tests, offline, console baseline.

## Implementation plan

1. `ledger.append`: keep the pre-check; change `INSERT_ENTRY` to
   `INSERT OR IGNORE`; when `changes===0` and `operationId` present,
   reselect by operation and return it (throw only if the row
   inexplicably vanished — defensive, practically unreachable).
2. Tests: overlapping same-operationId appends → one row, both callers
   get the same entry, no throw; merge-owned cosmetic (settings union,
   no ledger entry, funded balance) → `already-owned`, balance unchanged.
3. Full matrix + adversarial review + close.

## Test plan

- New race + merge-ownership tests (red→green: race throws today).
- Existing economy/claim/ledger suites green (no semantic drift).
- Full gated Jest + console gate + typecheck + lint + validators +
  OpenSpec strict.

## Runtime/native evidence plan

No UI/route/game change: repository gates are the evidence.

## Rollback / risk notes

- OR IGNORE only suppresses the operationId-unique conflict; all other
  constraint violations still throw. The reselect-after-ignore closes
  the only new branch.
- Callers that asserted the UNIQUE throw (none found — only raw-SQL
  index tests pin it) would need updates; verified by suite run.

## Completion criteria

Standard terminal bar + race test green + full matrix exact counts +
adversarial review + pushed + `HEAD == origin/main`.
