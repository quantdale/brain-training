# Campaign 030B closure

Date: 2026-09-17

## Decision

**`READY_FOR_CAMPAIGN_031`**

This decision means the current Android technical baseline is trustworthy
enough for the next redesign campaign. It does not mean the redesign is
implemented, that human usability is complete, that iOS is validated, or that
remote GitHub Actions is green.

## SHA and synchronization record

| Checkpoint | SHA / state |
| --- | --- |
| Pre-sync local `main` | `a5224ee2a58bc8028006f29b45416fff342a0326`, clean and aligned before fetch |
| First fetched remote | `4fa2e3dde7d371485d27262b8cd984f0a369f125` |
| Remote advanced during runtime work | `7f08bf0d92ad15cdee8b4f82900cf919f5932e9a` |
| Pre-documentation `main` | `7f08bf0d92ad15cdee8b4f82900cf919f5932e9a` |
| Final documentation SHA | The final commit containing this closure, reported by the final Git handoff |

The final hash is intentionally reported by Git after commit/push rather than
embedded self-referentially in the commit contents. The final handoff must
verify `HEAD == origin/main` and a clean worktree.

Campaign 029's effective product baseline remains
`5c484a08083963439360cb06c229249029f90531`. Current post-baseline changes are
tests, documentation, and a QA workflow contract/name update; no product UI,
runtime source, dependency, Expo configuration, persistence/schema, scoring,
game, or workout logic was changed by this campaign.

## Runtime and evidence outcome

- The failed ATD path was replaced by the disposable normal-phone Pixel 7
  `braintraining-c030b`, API 35 Google APIs x86_64, serial `emulator-5562`.
- The first hard-gate Home PNG is a real 1080 x 2400 product frame with 1,757
  full-image colors, luminance standard deviation 47.173679, and hash
  `f3597894ce55e1ed921362cfd3e44dbfaeba246b626140a4c3f9fb72e32a1bf4`.
- The exact successfully assembled universal debug APK is
  `80e9b29134fb70d7c45e30b7bb0fb6f6e90ee8d358b1880b9fa236e98a877d6a`; it
  installed successfully and passed a post-reboot Home/tree check.
- The exact APK produced 22/22 route-verified, non-uniform screenshots in
  both light and dark themes. The PNG/XML index is in
  `VISUAL_BASELINE_INDEX.md`; raw artifacts remain in `D:\Temp`.
- The current dynamic fallback completed all four standard workout legs and
  observed active play, pause/resume, populated results, Next Game,
  progression, completion, background interruption, process relaunch, and
  persistence. The route/action/count evidence is in
  `GOLDEN_PATH_RUNTIME.md`.
- The storage-unavailable fixture rendered a real recoverable-error screen
  with Retry copy. A Retry tap did not clear that fixture in place; controlled
  close/reopen returned to the persisted Home state. Successful in-place Retry
  recovery remains unverified.

## Required local gates

| Gate | Result |
| --- | --- |
| `node scripts/validate-repo-state.mjs` | PASS |
| Task ownership / affected-map sync | PASS; 15 impact areas / 43 patterns in sync |
| Typecheck | PASS (`npm run typecheck`) |
| Lint | PASS (`npm run lint`) |
| CI-mode Jest | 553 suites passed, 4 allowlisted skipped; 6,548 tests passed, 5 skipped; 5 snapshots passed |
| Jest signal validator | PASS; 5 skips classified by the repository allowlist, 0 unclassified/ambiguous |
| Registry/catalog drift | PASS |
| Provenance/version checks | PASS; provenance self-test 5/5 |
| Offline/source validator | CLEAN; 970 source files scanned |
| Secret validator | CLEAN; 2,104 tracked text files scanned |
| Dependency audit | PASS under the repository allowlist; 5 accepted advisories, no unallowlisted moderate+ production finding |
| Workflow hygiene | PASS; self-test 44/44 and normal workflow checks pass |
| Runtime-QA contract | PASS |
| OpenSpec | PASS; 16/16 changes |
| Expo web export | PASS; 47 bundles / 20 static routes |
| Android assemble/install | PASS after one transient package-splitter failure; stacktrace rerun succeeded and ADB install returned `Success` |
| Static native matrix | PASS; 22/22 screenshots and 22/22 route-verified XML trees |
| Accessibility audit | 20/22 surfaces clear; 2 localized 43dp Progress-detail findings, plus recorded clipped-under-tab-bar notes; no finding suppressed |
| Expo Doctor | 20/21; 14 SDK-57 patch mismatches, disposition `DEFERRED_SEPARATE_MAINTENANCE` |
| GitHub Actions | Four current runs and four preceding runs failed before steps; classified `INDETERMINATE_EXTERNAL_PRE_STEP`, accepted as separate infrastructure debt |

## Readiness rule evaluation

| Campaign rule | Evidence-backed result |
| --- | --- |
| Dedicated non-user-owned runtime renders real pixels | PASS; normal phone AVD and non-uniform Home/matrix frames |
| Current light/dark core screenshots | PASS; 22/22 matrix, both themes |
| Start/Play/Result/Next/workout progress | PASS; deterministic semantic/ADB fallback through all four legs |
| Interruption/resume/relaunch/persistence | PASS for background pause restoration, unfinished-leg resume, 0/4 → 1/4, 4/4 completion relaunch, and persisted table counts |
| No product failure hidden by ATD | PASS; current product installed, booted, rendered, and ran on standard phone image; no source workaround |
| Local gates healthy or isolated/accepted | PASS with explicit localized a11y, transient packaging, Expo, and external CI classifications |
| Expo drift deliberate | PASS; deferred separate maintenance, not ignored |
| GitHub failures classified | PASS as far as API-visible evidence permits; no step/log cause available |
| Campaign 029 hypotheses cross-checked | PASS; see `CAMPAIGN029_VISUAL_CROSSCHECK.md` |
| Repository clean and synchronized | Required final post-commit/post-push verification |
| Human validation | `PENDING_PHASE_031`, explicitly carried as a Campaign 031 phase-exit gate |

## Remaining limitations and follow-up

1. The authorized ARTEMIS/OpenCode route was unavailable (external HTTP 503;
   no task was started). Deterministic fallback evidence is authorized and
   complete for the standard workout, but no ARTEMIS trace is claimed.
2. The ARTEMIS diagnostic response contained an inconsistent top-level device
   summary field while its explicit probe targeted `emulator-5562`. Because no
   task was started, this response was not used to claim device actions; all
   actual runtime commands were explicit ADB commands for c030b.
3. A runtime network-disabled journey, large-font/landscape/compact/expanded
   profiles, iOS, and human usability remain unvalidated. Human work is
   mandatory before Campaign 031 exits.
4. Data Management's `Empty` storage-size hero conflicts with populated local
   table counts; record this as trust/observability maintenance debt, not data
   loss.
5. Progress Detail has a 43dp history row in both themes. Games/Profile retain
   clipped-under-tab-bar audit notes. These are localized follow-up issues and
   not primary-action failures.

No redesign, Campaign 031 work, dependency update, Expo configuration change,
CI workflow change, persistence change, schema change, or gameplay/workout
change was implemented.
