# Design — Campaign 017 Persistence Boundary Hardening

## 1. Authoritative invariants

1. Every persisted integer-domain value is a safe integer before it reaches
   SQLite. Existing legacy rows remain readable; new writes cannot create a
   new fractional or negative economic/progression value.
2. A completed session is identified by its stable session id. Rating history
   has at most one movement per `(session_id, domain)` and replayed completion
   or import data cannot append a second movement.
3. Replace import is an all-or-nothing operation. Append-only guards are never
   left disabled after failure, and a backup cannot export another profile's
   data.
4. User-facing history/progression reads may be bounded by an explicit
   `throughMs`; the bound is validated and applied before ordering/limiting.
   No-argument export/repair reads retain their all-history contract.
5. Same-time conflict decisions are symmetric and deterministic, and a no-op
   sync pull never rewinds a caller's cursor.

## 2. Implementation shape

- Keep validation in repositories and deserialization rather than relying on
  SQLite's dynamic typing or UI callers.
- Add forward-only schema migrations for new constraints/triggers and repair
  known duplicate historical rows deterministically before creating a unique
  index.
- Keep portability writes in one transaction; perform connection-level trigger
  management only in the narrow replace wrapper and recreate guards in a
  `finally` path.
- Thread one captured clock boundary through analytics/progression callers;
  do not silently convert all-history maintenance APIs into bounded APIs.
- Test the public seams with real better-sqlite3 adapters, including malformed
  and interrupted paths.

## 3. Non-goals

No schema rewrite, remote sync service, encryption/key-management product,
native module, catalog expansion, or store-release work is introduced here.
