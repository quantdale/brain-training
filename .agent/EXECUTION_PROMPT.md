# Execution Prompt — Campaign 032: Games discovery and identity redesign

**Status:** ACTIVE
**Change:** `032-games-discovery-identity-redesign`
**Planned-From:** `fa29742f08636b455f23a90c27cec61798fb1024`
**Start-SHA:** `fa29742f08636b455f23a90c27cec61798fb1024`
**Planned-At:** 2026-09-17
**Target-Branch:** `main`
**Predecessor:** `031-golden-path-redesign`

## Authority

Read and execute the complete
`.agent/CAMPAIGN032_GAMES_DISCOVERY_IDENTITY_REDESIGN_PROMPT.md`. It is the
authoritative product task specification for this campaign. Campaign 031
real-pixel/runtime evidence is the before context. Do not begin Campaign 033.

## Mission

Restructure Games around one Suggested Next model and a clear Browse All model;
preserve and consolidate the existing recommendation evidence; improve search,
filters, favorites, and no-results behavior; give every catalog entry a
restrained shared identity; and make Game Detail explain the mechanic and make
Play dominant before deep history.

## Protected behavior and scope

Preserve all 42 catalog entries, the generated registry and provenance,
lazy-loading, favorites persistence, mastery semantics, tutorial/session
behavior, workout eligibility, standalone entry, scoring/generator metadata,
and offline behavior. Do not change Home, Progress, Profile, Rewards,
economy, dependencies, CI, schema, or game mechanics.

## Required validation and handoff

Run the complete Campaign 032 matrix: repository/catalog/native/accessibility/
persistence checks; focused and full Jest; eight primary domain/mechanic-family
representatives; disposable normal Android AVD real-pixel before/after and
light/dark evidence; offline/security/ownership/OpenSpec/web/native gates; and
human validation when genuinely available. Otherwise record the exact pending
handoff without invented findings. Produce every required document under
`docs/redesign/evidence/campaign032/`, update durable state, commit and push
`main`, verify `main == origin/main`, and leave the worktree clean.
