# Durable Backlog

Historical phase list — superseded by implementation reality (42-game
catalog, Workout V3 signal-ranked templates over the V2 template engine,
full progression/portability shipped; see
`docs/PARITY_MATRIX.md`). Active work is owned by the campaign in
`.agent/CURRENT_CAMPAIGN.md`; this file only records durable work outside
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

## Campaign 024 follow-ups (added 2026-09-12)

Deferred, non-blocking, and only worth doing with a reason:

- Extend the shared answer-feedback language to the remaining 34 game boards
  (eight canaries landed it; the rest keep their own board styling while
  inheriting the upgraded chrome).
- Feed real round progress into `GameHost.roundProgress` so the HUD's segmented
  progress bar is used instead of the plain round chip (per-game wiring).
- Consider a virtualized list for the Games library if the catalog grows well
  beyond 42 entries; the current chunked grid renders fine at this size.
- Richer Progress visualizations (line charts with axes, per-domain sparklines)
  once real usage data exists to justify them.
- Re-run the full-catalog `--mode certify` gate on a host with a single attached
  device to convert today's blocked classification into evidence.
