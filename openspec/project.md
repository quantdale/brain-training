# Brain Training — OpenSpec Project Context

## Product

Offline-first React Native + Expo brain-training app with a modular Game SDK, SQLite as canonical local storage, Android-first autonomous QA, and a growing catalog of short cognitive games.

## Canonical repository

`quantdale/brain-training`, branch `main`.

## Core invariants relevant to changes

- Core gameplay works offline.
- SQLite is authoritative local persistence.
- Completed sessions persist atomically with authoritative progression effects.
- Historical sessions preserve scoring/generator/content provenance.
- Difficulty is player-facing named modes plus fine-grained internal challenge.
- Easy-mode farming must not inflate skill ratings.
- Daily Workout is normally four games and should flow game -> compact result -> next game.
- Currency uses append-only transactions and must not be corrupted by partial operations.
- Generated challenges must be deterministic and valid for the active rules/difficulty.
- Tutorials show on first play, then remain completed across restarts, while still replayable.
- Android autonomous QA must not hijack host mouse/keyboard.
- Main should be buildable/startable at coherent pushed checkpoints.
- No fake green: unavailable validation is NOT VALIDATED/BLOCKED.
- No new breadth should be built on known Critical/High integrity defects.

## Spec-driven development convention

Every major corrective or feature campaign should have one change folder under `openspec/changes/` containing proposal, design, normative capability specs, task checklist, and execution entrypoint. Agents should implement against these files rather than rely on chat prompts.