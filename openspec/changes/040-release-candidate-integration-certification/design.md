# Design — Campaign 040

## Certification order

1. Verify synchronized `main`, current source, generated catalog, and clean
   dedicated runtime conditions.
2. Run repository gates and build/install the current release candidate.
3. Exercise representative integrated journeys: daily workout/start, a
   standalone game and result, persistence/relaunch, Games discovery/search,
   Progress drill-down, Profile/Rewards/Data, invalid/empty routes, theme,
   accessibility audit, and offline operation.
4. Recheck all 42 catalog identities and representative mechanics using
   current source plus runtime-observable entries; do not claim every mechanic
   was manually played unless it was.
5. Inspect current rendered pixels/XML and compare against the retained
   campaign evidence, then review copy and dead/TODO debt.
6. Query current external CI and classify unavailable or infrastructure-only
   results separately from local/native product evidence.

## Protected seams

The pass preserves SQLite/profile/session/workout identity, migrations,
backup/restore semantics, append-only economy, offline-first behavior,
gameplay/scoring/generator contracts, recoverable routing, and the locked
no-medical-claims boundary. Any severe regression blocks certification and is
repaired or left explicitly blocked before further product work.

## Result labels

The terminal result must be one of `CAMPAIGN_040_CERTIFIED`,
`CAMPAIGN_040_CONDITIONAL`, `CAMPAIGN_040_PARTIAL`, or
`CAMPAIGN_040_BLOCKED`; no global success label is implied by a conditional
Android-only result.
