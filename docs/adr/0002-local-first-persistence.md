# ADR 0002 — Local-First Persistence

**Status:** Accepted  
**Date:** 2026-08-16

## Context

The core application must work offline and accounts/cloud are optional/deferred.

## Decision

SQLite is the canonical local store. Gameplay writes locally first. Future cloud sync is asynchronous and merge-aware rather than a prerequisite for gameplay.

## Consequences

The local schema/migrations are critical product infrastructure. Persistent formats require explicit versions/migrations and completed game sessions must commit atomically.
