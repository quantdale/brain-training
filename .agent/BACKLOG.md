# Durable Backlog

Historical phase list — superseded by implementation reality (42-game
catalog, Workout V2, full progression/portability shipped; see
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
