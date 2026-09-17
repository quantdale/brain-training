# Campaign 032 — Games discovery and identity redesign

## Why

The existing Games surface exposes useful recommendation evidence through a
featured hero and three peer shelves, but the hierarchy does not clearly
separate “what should I play next?” from “which game do I want to choose?”
Cards also rely mainly on names, domains, and generic descriptions, while Game
Detail makes the mechanic and play decision compete with historical detail.

## Outcome

Give Games two legible jobs: one consolidated Suggested Next area that explains
why a deterministic recommendation is useful now, and one Browse All area with
search, category, favorites, count, reset, and honest empty states. Introduce a
restrained identity grammar shared across all 42 games, then use it in cards
and Game Detail so the interaction is understandable before the player starts.

## Scope guard

This is a presentation and discovery composition change at existing seams. It
does not alter catalog definitions, generated registry output, lazy loading,
game modules, SDK contracts, SQLite schema, favorites/mastery persistence,
workout eligibility, tutorial/session behavior, offline behavior, mechanics,
Home, Progress, Profile, Rewards, economy, dependency versions, or CI.
