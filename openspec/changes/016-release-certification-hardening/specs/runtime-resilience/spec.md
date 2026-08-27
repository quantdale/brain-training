# Runtime Resilience Requirements

## Requirement RR-1 — Durable workout ownership
Workout completion SHALL remain causally attributed and idempotent across duplicate delivery, process death, results reopen, and concurrent same-game active workout instances.

## Requirement RR-2 — Persistence failure safety
Database lock/unavailable/corrupt-state paths SHALL fail without silently corrupting progression, rewards, workout state, or backup state.

## Requirement RR-3 — Portability integrity
Backup/import/replace/rollback SHALL preserve validation, atomicity, versioning and integrity metadata under malformed, interrupted and historical-schema cases.

## Requirement RR-4 — Lifecycle timing fairness
Background, pause, resume and force-timeout behavior SHALL not grant free response time, study time, duplicate rewards, or rating corruption.

## Requirement RR-5 — Production boundary
Production/native release builds SHALL not expose development-only mutation hooks, forbidden permissions, accidental network calls, secrets, or telemetry.
