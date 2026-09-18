# Campaign 050 Performance and Accessibility Reconciliation

## Current performance baselines

The current probe run passed and wrote:

- `scripts/perf/baselines/perf-baseline-2026-09-18T21-10-41-371Z.json`
- `scripts/perf/baselines/perf-sync-scan-2026-09-18T21-10-41-371Z.json`

Representative measurements were 17.2182 ms for a 5,000-row full history
query, 87.2666 ms for 20,000 rows, 67.3322 ms for the 5,000-row progress
snapshot, 138.7192 ms for 20,000 rows, 3,931.1678 ms for canonical 5,000-row
export including checksum, and 37.4219 ms for 20,000 quest-progress sync.
These are repository probes, not user-device SLAs.

Campaign 048 remains the runtime reliability baseline: three release
force-stop/relaunch cycles rendered Home at 6,324 / 5,002 / 5,866 ms, and the
bounded PSS sample was 247,176 / 246,168 / 246,696 KB with a stable view count.
Campaign 050's direct cold launch was 10,047 ms after the protected journey,
with no filtered app error marker.

## Responsive and automated a11y captures

- Font scale 2: 12/12 captures, light/dark, route-verified and nonblank;
  separate density-420 audit: 0 violations.
- Compact profile: 12/12 captures, light/dark, route-verified and nonblank;
  separate density-320 audit: 0 violations.
- Surfaces: Home, Games, Game Detail, Progress, Profile, Data Management.
- Raw artifacts: `D:\Temp\campaign050-matrix` and
  `D:\Temp\campaign050-matrix\compact`.
- Clipped rows beneath the fixed tab bar are reported by the audit harness as
  scroll-under-tab observations, not actionable interactive-node violations.

The compact capture emitted one `null root node returned by
UiTestAutomationBridge` message during a theme/profile transition, but its
manifest completed 12/12. It is retained as a tooling caveat. No human
TalkBack/VoiceOver traversal is claimed.
