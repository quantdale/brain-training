# Durable Backlog

Historical phase list — superseded by implementation reality (42-game
catalog, Workout V3 signal-ranked templates over the V2 template engine,
full progression/portability shipped; see
`docs/PARITY_MATRIX.md`). Active work is owned by **Campaign 027**
(`027-deep-hardening`, active deep hardening with feature development frozen)
in `.agent/CURRENT_CAMPAIGN.md`; this file only records durable work outside
any campaign.

## Still-open durable items

- iOS build validation when a macOS/Xcode environment exists (static
  compatibility maintained source-level today).
- SAF share/picker consent sheets require an interactive manual QA path
  (autobot policy forbids driving system consent UIs).
- Deferred product decisions (see `docs/DEFERRED_DECISIONS.md`) stay untouched
  until the owner decides.

## Resolved

- Lint warning inventory: RESOLVED in Campaign 013 — repo lints at
  0 errors / 0 warnings (was ~430–474); no blanket suppressions.
- Campaign 024 follow-up — shared answer-feedback language: COMPLETED in
  Campaign 025 across all game boards (31 remaining boards mapped on top of
  the Campaign 024 canaries).
- Campaign 024 follow-up — HUD round progress: COMPLETED in Campaign 025;
  `GameHost.roundProgress` is wired in 41/42 games, with
  `memory-sequence-memory` intentionally keeping the round chip (time-boxed
  score attack, no round total).

## Campaign 024 follow-ups (added 2026-09-12; reconciled 2026-09-13)

Deferred, non-blocking, and only worth doing with a reason:

- Consider a virtualized list for the Games library if the catalog grows well
  beyond 42 entries; the current chunked grid renders fine at this size.
- Richer Progress visualizations (line charts with axes, per-domain sparklines)
  once real usage data exists to justify them.
- Re-run the full-catalog `--mode certify` gate on a host with a single attached
  device to convert today's blocked classification into evidence.

Campaign 027 W2 owns the active bounded hot-path and export work
(`.agent/CURRENT_CAMPAIGN.md`); the items above remain outside it.
