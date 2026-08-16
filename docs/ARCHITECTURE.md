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
└── Future seams (not implemented early)
    ├── auth
    ├── cloud sync
    ├── AI/RAG
    ├── entitlements/monetization
    ├── notifications/widgets
    └── public-release services
```

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

The exact directory structure and APIs are intentionally left to Phase 1 implementation research and ADRs. Agents should prefer architecture that permits multiple coder agents to add game modules without touching the same shared files.
