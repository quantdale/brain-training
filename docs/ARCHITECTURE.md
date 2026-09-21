# Architecture Direction

This document records the current architectural shape. It is intentionally higher-level than implementation code and should be updated as accepted ADRs refine it.

## Target shape

```text
App shell
├── Home / Today's Workout
├── Games library
├── Progress
├── Profile / More
│
├── Core domain
│   ├── Local profile
│   ├── SQLite + migrations
│   ├── Sessions/history
│   ├── Skill ratings
│   ├── XP/player level
│   ├── Currency transaction ledger
│   └── Daily calendar/streak state
│
├── Game Platform
│   ├── Game SDK
│   ├── Generated game registry/index
│   ├── Scoring normalization
│   ├── Difficulty/adaptation
│   ├── deterministic RNG
│   ├── timing abstraction
│   ├── tutorial/help contract
│   └── QA/diagnostics contract
│
├── Game modules
│   ├── memory/*
│   ├── attention/*
│   ├── speed/*
│   ├── math/*
│   ├── language/*
│   ├── logic/*
│   ├── flexibility/*
│   └── spatial/*
│
├── Content Platform
│   ├── bundled core packs
│   ├── pack version/integrity metadata
│   └── future optional downloadable packs
│
└── Future seams (see notes below)
    ├── auth (not implemented)
    ├── cloud sync (seam exists: src/sync/** is an offline no-op change log)
    ├── AI/RAG (not implemented)
    ├── entitlements/monetization (scope stubs exist: src/entitlements/**)
    ├── notifications/widgets (scope stubs exist: src/notifications/**)
    └── public-release services (not implemented)
```

Seam status (reconciled 2026-09-21, Campaign 066): `src/sync`,
`src/entitlements`, `src/notifications`, and `src/assistant` exist as
non-shipping seams or stubs; auth and public-release services are not
implemented. Product decisions behind any of these remain deferred
(`docs/DEFERRED_DECISIONS.md`).

## Non-negotiable architectural characteristics

- offline-first local writes
- SQLite as canonical local persistent state
- modular games with limited shared edit hotspots
- deterministic procedural content where applicable
- versioned persistent/scoring/generator contracts
- safe atomic completion of game sessions
- Android automation without host mouse/keyboard
- one-emulator expensive-validation owner
- explicit QA hooks/semantic IDs from the start

## Pending architecture

Phase 1 shipped; the directory structure and APIs are implemented in
`apps/mobile/src/**` and governed by the layer rules above. Any
structural change still needs an ADR under `docs/adr/`.
