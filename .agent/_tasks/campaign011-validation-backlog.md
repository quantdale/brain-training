# Campaign 011 Validation Backlog (handoff from Campaign 010)

Campaign 010 is implementation-only. Every area below requires dedicated
verification in Campaign 011 (TEST / AUDIT / QA / FIX / HARDEN). Append entries
continuously during the wave using this per-entry shape:

```
### <Subsystem>
- Files/features changed:
- Risk level: Critical / High / Medium / Low
- Required unit tests:
- Required integration tests:
- Required emulator path:
- Required property/invariant checks:
- Required performance measurements:
- Platform requirements:
```

## Standing entries (pre-wave)

### Catalog contract compliance — new games W01–W04
- Files/features changed: 4 new game modules (ids TBD by workers)
- Risk level: High
- Required unit tests: generator determinism, scoring bounds, pause freeze, force-win paths
- Required integration tests: session persistence round-trip
- Required emulator path: full journey via autobot smoke chain for each new game
- Required property/invariant checks: catalog-contracts suite over new modules
- Required performance measurements: none specific
- Platform requirements: Android primary

### GameHost migrations — W05
- Files/features changed: components/game-host/**, migrated game screens
- Risk level: High
- Required unit tests: per-migrated-game screen suites still pass
- Required integration tests: lifecycle parity vs pre-migration behavior
- Required emulator path: migrated games smoke chain
- Required property/invariant checks: catalog-contracts scanner recognition of GameHost modules
- Required performance measurements: none
- Platform requirements: Android; visual baselines may need deliberate regeneration

### Query performance rewrite — W09
- Files/features changed: analytics/queries.ts, projections
- Risk level: High
- Required unit tests: result-equivalence vs previous snapshot outputs on fixture DBs
- Required integration tests: progress screens render identical data
- Required emulator path: progress screens on device-size data
- Required property/invariant checks: aggregate SQL vs JS reference on seeded fixtures
- Required performance measurements: re-run scripts/perf baselines (101ms@20k target)
- Platform requirements: none beyond Node test env

### Backup transport wiring — W10
- Files/features changed: data-portability transport/serializer
- Risk level: Critical (data safety)
- Required unit tests: serializer equivalence, checksum stability, atomic restore, rollback
- Required integration tests: export→wipe→import round-trip via real filesystem transport
- Required emulator path: share-sheet/document-picker flows on Android
- Required property/invariant checks: canonical-form invariants
- Required performance measurements: re-run export baseline (~2.4s@5k target)
- Platform requirements: Android SAF; iOS picker semantics NOT VALIDATED (no macOS)

### Platform/deps cleanup — W15
- Files/features changed: app.json, AndroidManifest, package.json (parent-applied removals)
- Risk level: Medium
- Required unit tests: existing suites unaffected
- Required integration tests: app boots after dependency removals
- Required emulator path: cold start + representative journey post-cleanup
- Required property/invariant checks: expo-doctor, provenance/offline validators
- Required performance measurements: binary size delta optional
- Platform requirements: Android build required; iOS prebuild NOT VALIDATED

### Cross-platform seams — W16
- Files/features changed: screen-shell, platform adapters, tokens
- Risk level: Medium
- Required unit tests: inset math under mocked safe-area
- Required integration tests: pushed-route layouts
- Required emulator path: notched-device visual pass
- Required property/invariant checks: none
- Required performance measurements: none
- Platform requirements: iOS device/simulator verification NOT VALIDATED (no macOS host)
