# Task Packet 001-b — SQLite Persistence Layer (WP-B)

Campaign: 001-autonomous-foundation
Status: DONE
Owner role: coder agent

## Objective

Establish the canonical local persistence layer under `apps/mobile/src/db`:

- versioned schema + migration runner (schema version constant, ordered migrations, `user_version` tracking, transactional application).
- one persistent local profile row (created on first launch; id, display name placeholder, created/updated timestamps, settings JSON).
- session-history table for completed game sessions (game id, game/generator/scoring versions, seed, difficulty params, raw + normalized result, XP, started/completed timestamps, duration, payload JSON).
- append-only currency transaction ledger (id, timestamp, amount, reason, session ref) with a balance derivation view/query; enforce monotonic ledger ids.
- atomic API: `completeSession(...)` commits session + ledger + profile touch in one transaction.
- storage abstraction so the same SQL runs in-app (expo-sqlite) and in Node tests (better-sqlite3 dev dependency, already installed by orchestrator). Keep the SQL dialect to the common subset.

## Dependencies

- Orchestrator scaffold commit including jest-expo and `better-sqlite3` dev deps.

## Allowed write surfaces

- `apps/mobile/src/db/**` (all persistence code: schema, migrations, repositories, services).
- `apps/mobile/src/db/__tests__/**` (unit/integration tests using the Node SQLite backend).
- `apps/mobile/src/profile/**` if a small typed profile facade is cleaner there.

## Forbidden / shared write surfaces

- `package.json`, `package-lock.json`, jest config, tsconfig (report needs to orchestrator).
- `apps/mobile/app/**`, `apps/mobile/src/sdk/**`, `apps/mobile/src/games/**`, `apps/mobile/src/theme/**`.
- Root `scripts/**`, `.github/**`, `.agent/**`, `docs/**`.

## Completion criteria

- Migrations run from empty DB to current version; re-running is a no-op; migration failure rolls back cleanly.
- Profile: create-if-absent + update + read.
- Session: `completeSession` persists atomically; crash mid-transaction leaves no partial session (tested via forced failure or rollback assertion).
- Ledger: append-only; balance query matches sum of amounts.
- All tests pass with the Node backend; in-app path uses the same SQL via expo-sqlite adapter.

## Cheap validation

- `npm test` (jest) for the db suite
- `npx tsc --noEmit`

## Integration notes for orchestrator

- Expose a `DatabaseProvider`/`getDb()` entry the app can initialize once at startup (document the call site the orchestrator must wire, e.g. app entry or route layout).
- Do not wire app startup yourself — orchestrator owns `app/_layout.tsx` convergence.

## Result/evidence

(agent fills in)
