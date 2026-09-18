# Campaign 048 — Startup, Performance, Resource & Reliability Soak

## Objective

Measure current startup and persistence-related runtime behavior after the
Campaign 047 checkpoint. Establish a bounded baseline for release cold starts,
Home content readiness, representative route access, force-stop/relaunch, and
repository-scale query/export operations.

## Scope

- release cold start and force-stop/relaunch sample;
- Home skeleton-to-content transition;
- existing release route and game lifecycle markers;
- SQLite bootstrap/progression/session persistence timings;
- 5k/20k query, progress, export, quest, and achievement probes;
- app-only crash/ANR/React/SQLite/lock/OOM inspection.

## Non-goals

No speculative optimization, broad profiling rewrite, dependency churn, or
claim that emulator timings represent all physical devices.
