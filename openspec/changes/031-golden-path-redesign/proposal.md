# Campaign 031 — Golden-path redesign

## Why

Campaign 030B proved the mature game and workout engines on a real Android
AVD, but its primary surfaces presented too many equally weighted decisions.
The Today hero combined workout action, progress, economy, and engagement
systems; the intro repeated dashboard-like detail; and Results made reward
feedback compete with the outcome and the next workout leg.

## Outcome

Recompose the production golden path so a player can understand Today, start or
continue the persisted workout, learn the current mechanic, play with focused
shared chrome, understand the result, continue directly to the next leg, and
finish with an explicit saved completion state.

## Scope guard

The change is presentation and flow work at existing seams. It must not alter
SQLite schema/version semantics, workout instance identity, provenance,
generators, scoring, lifecycle, session identity, rating/XP/currency writes,
reward idempotency, tutorial persistence, registry determinism, or offline
behavior. Games discovery, full Progress, Profile, Rewards, dependency
maintenance, CI repair, and unrelated debt remain out of scope.
