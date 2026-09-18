# Campaign 041 — Campaigns 001–040 Hardening Closure

## Verdict

**CAMPAIGN_041_CONDITIONAL**

This is a current-evidence verdict, not an endorsement of historical PASS labels. The current product core is strong on the dedicated Android emulator: the repository gates pass, the four-game workout completes through the real current path, persisted completion survives force-stop/relaunch, the backup round-trip preserves representative state, all 42 registered games traverse the standalone lifecycle, and all eight mechanic/domain families have fresh real interaction evidence. The verdict remains conditional because release/platform/human boundaries are not fully covered, the current light debug capture has a LogBox overlay touch-target artifact, GitHub Actions fail before steps run, and one intermittent SQLite `prepareAsync` startup failure was observed but not minimized to root cause.

## Scope and evidence doctrine

Campaign 041 was executed against current source and runtime state after safely synchronizing `main`. Historical reports, screenshots, snapshots, state files, and prior PASS labels were treated as leads only. Current claims are tagged in this packet:

- `[OBSERVED_RUNTIME]` — fresh native behavior or captured pixels.
- `[VERIFIED_PERSISTED_STATE]` — direct SQLite/ADB inspection.
- `[VERIFIED_TEST]` — executable test or validator result.
- `[VERIFIED_SOURCE]` — current source/configuration inspection.
- `[VERIFIED_BUILD]` — current generated build/package evidence.
- `[VERIFIED_GIT]` — current Git or remote evidence.
- `[HISTORICAL_ONLY]` — historical claim not independently reproduced as historical behavior.
- `[INFERRED]` — reasoned classification, not direct proof.
- `[CONTRADICTED]` — current evidence disproves the older claim.
- `[BLOCKED]` — attempted but unavailable because of a tooling/environment boundary.
- `[MANUAL/EXTERNAL_PENDING]` — requires human, physical device, iOS, store, or external account validation.

## Git and product identity

| Item | Evidence |
|---|---|
| Starting SHA | `[VERIFIED_GIT]` `4c0e5f819bbc1d7fd83f9ac979e19406c50753a9` |
| Starting remote | `[VERIFIED_GIT]` `origin/main` was `56bf17d8b3a857f0ac645330ecbe1fe54fd8c8a1`; it was fetched and had no newer commit. |
| Synchronization | `[VERIFIED_GIT]` The pre-existing local `campaign-log.txt` commit was preserved and pushed fast-forward to `origin/main`; no reset, force-push, or user-work deletion was used. |
| Validated product/source SHA | `[VERIFIED_BUILD]` `4c0e5f819bbc1d7fd83f9ac979e19406c50753a9` (the product tree tested during this audit; Campaign 041 evidence/state commits are documentation-only). |
| Final SHA | Recorded in the final Git handoff after the evidence/state commit. |
| Product source changed | No. Campaign 041 made no product source, schema, scoring, registry, workflow, or dependency changes. |

## Ledger summary

| Current status | Rows |
|---|---:|
| `CURRENTLY_VERIFIED` | 13 |
| `SUPERSEDED_BUT_CURRENTLY_SAFE` | 17 |
| `PARTIALLY_VERIFIED` | 10 |
| `CONTRADICTED_BY_CURRENT_EVIDENCE` | 0 |
| `NOT_RECONSTRUCTABLE` | 0 |
| `NOT_APPLICABLE_TO_CURRENT_PRODUCT` | 0 |
| **Total** | **40** |

The ledger explains why Campaign 006 is represented as `006R`: the repository has no independent standalone Campaign 006 packet discoverable in the current history. This is recorded as a reconstruction limitation rather than inventing a missing campaign.

## Current evidence highlights

- `[VERIFIED_TEST]` Jest CI mode: 557 passed suites, 4 intentionally skipped suites, 6,568 passed tests, 5 intentionally skipped tests, 0 failed; 5 snapshots passed. The certification signal validator classified all 5 skips and reported 0 unclassified/ambiguous warnings.
- `[VERIFIED_TEST]` All five historical performance/large-backup opt-in probes were executed directly and passed: performance baseline, sync scan, quest evaluation, projection differential, and 20,000-session large-backup memory.
- `[VERIFIED_BUILD]` Typecheck, lint, Expo Doctor 21/21, web export, Android debug build, and Android release build passed. Release APK SHA-256: `1FF87618F190513BC04A84BA597BC0BE8764317EA8B5BC4720683EB4BE539DAA`.
- `[OBSERVED_RUNTIME]` The dedicated Android emulator completed the four-game daily plan `flexibility-cue-shift → language-word-chain → logic-order-path → flexibility-color-stroop`; final UI showed `4/4 games complete`, and Home later showed `4/4 games saved`.
- `[VERIFIED_PERSISTED_STATE]` The completed workout had 4 sessions, 200 total session XP, 4 unique +10 currency ledger operations, 8 rating-history rows, and no duplicate gameplay operation IDs. Force-stop/relaunch preserved completion.
- `[VERIFIED_PERSISTED_STATE]` A separate interruption/resume path persisted index `1`, one session, one currency operation, and two rating rows after relaunch; no duplicate write appeared.
- `[VERIFIED_PERSISTED_STATE]` Export/import round-trip preserved the representative session, ratings, ledger, workout, achievements, profile, and quest state. Export checksum matched its claimed checksum: `b82d5ed9b4902f28f342dbd46422c90f8ac5d0c2d3594a311c930b608fa038d`.
- `[OBSERVED_RUNTIME]` All 42 catalog IDs reached Game Detail and a first interactive state on the current build. A generic detector initially missed three games; explicit live-hierarchy/source checks corrected those detector false negatives. This is recorded as 42/42 lifecycle, not 42/42 mechanic mastery.
- `[OBSERVED_RUNTIME]` Fresh real interaction was performed in all eight mechanic/domain families, including a real wrong answer in Color Stroop and Color Match, and visible response/result state in each family.
- `[OBSERVED_RUNTIME]` A current debug matrix captured 22 light/dark surfaces and a responsive matrix captured 12 compact/font-scale surfaces. All captures were nonblank and route-verified. The light debug a11y violations were the React Native LogBox close control, not the app’s tab bar; the exact replay after reset had no LogBox.
- `[BLOCKED]` Release XML hierarchy/a11y capture was blocked by an already-registered UiAutomation service. Release pixels and ARTEMIS semantic hierarchy were still inspected; this does not prove full release a11y.
- `[OBSERVED_RUNTIME]` A single matrix run surfaced `NativeDatabase.prepareAsync`/`NullPointerException` while loading today’s workout. Cold relaunch recovered it; a minimized reproduction/root cause was not established, so it remains an open conditional observation rather than a claimed repair.
- `[INFERRED]` Current GitHub Actions failures are external pre-step failures: four runs have completed with `steps=0`, no failed log is available, and no repository command ran. Workflow YAML was not changed.

## Repairs

No Campaign 041 product repairs were made. The observed SQLite startup failure was not sufficiently minimized to justify a safe fix. No tests, assertions, allowlists, workflows, persistence formats, scoring, economy, or registry IDs were weakened or changed.

## Conditional release boundary

Before a release-certifying verdict, obtain: a minimized/reproduced startup SQLite failure disposition; a clean release-build XML/a11y pass without the UiAutomation-service collision; a real signed release artifact test under the intended signing/install path; human accessibility/usability review; physical Android and iOS validation; store/document/share-sheet checks; and a successful external CI run or provider diagnosis. See the handoff and adversarial-pass documents for the exact boundary.

## Evidence index

| Artifact | Coverage |
|---|---|
| `HISTORICAL_CAMPAIGN_LEDGER_001_040.md` | One row for every campaign number 001–040 and current status. |
| `CURRENT_CONTRACT_MATRIX.md` | Current shell, golden path, catalog, data, cross-cutting contracts. |
| `REPOSITORY_VALIDATION_MATRIX.md` | Full tests, validators, opt-in probes, test-quality review. |
| `PERSISTENCE_MIGRATION_BACKUP_AUDIT.md` | Fresh state, SQLite, migrations, export/import/restore. |
| `WORKOUT_SESSION_INVARIANTS.md` | Four-game workout, exactly-once writes, interruption/resume. |
| `GAME_CATALOG_42_LIFECYCLE_MATRIX.md` | Every registered ID and lifecycle/mechanic distinction. |
| `NATIVE_RUNTIME_MATRIX.md` | Native route, pixel, release, responsive, workout evidence. |
| `ACCESSIBILITY_TOUCH_TARGET_AUDIT.md` | Hierarchy, labels, touch targets, clipping, known tooling artifact. |
| `RELIABILITY_CONCURRENCY_STRESS.md` | Repeated actions, lifecycle stress, logs, DB outcomes. |
| `PERFORMANCE_RESOURCE_SANITY.md` | Timings, large backup resources, startup observations. |
| `SECURITY_DEPENDENCY_RELEASE_AUDIT.md` | Offline/secrets/QA controls/dependencies/release manifest. |
| `EXTERNAL_CI_CLASSIFICATION.md` | Current GitHub Actions runs and pre-step classification. |
| `DEFECT_REPAIR_LOG.md` | Reproduction/fix policy and why no repair was justified. |
| `ADVERSARIAL_SECOND_PASS.md` | Mandatory independent attempt to disprove the first audit. |
| `HUMAN_PLATFORM_VALIDATION_HANDOFF.md` | Precise remaining manual/platform work. |

