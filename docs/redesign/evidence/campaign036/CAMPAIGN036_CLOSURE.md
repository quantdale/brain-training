# Campaign 036 closure

## Verdict

`CAMPAIGN_036_COMPLETE_READY_FOR_037`

The bounded first-run, empty-state, and local-trust work is complete and
validated. This is not a global release-clearance label: manual/platform
limits and external CI failures remain classified below.

## Scope closed

Home now makes the existing Start workout path explicitly local/offline;
Data Management distinguishes an initialized local store from an unavailable
byte-size metric; and Rewards explains its included starter cosmetics. The
clean-install no-session states remain truthful. No account gate, onboarding
funnel, permission request, unsupported cognitive/medical claim, schema,
economy, backup, gameplay, or persistence change was made.

## Evidence

- Implementation: `IMPLEMENTATION_SUMMARY.md`
- Before/after pixels and hashes: `BEFORE_AFTER_FIRST_RUN.md`
- Native flow/build/logcat: `RUNTIME_VALIDATION.md`
- Automated accessibility: `ACCESSIBILITY_VALIDATION.md`
- Human/platform limits: `HUMAN_VALIDATION_PENDING.md`

Starting SHA:
`27fd1f27866401b35da875a5250648babc768431`.

Source checkpoint:
`65336b24d610049f73fc57a8e1bf40dbbf242e35`.

## Validation result

- Focused Home/Rewards/Data Management contracts: **PASS**, 3 suites / 25
  tests.
- Full Jest: **PASS**, 556 passing suites / 4 skipped suites; 6,563 passing
  tests / 5 skipped tests; 5 snapshots passed.
- Typecheck and lint: **PASS**.
- Strict affected-area mapping, repo-state, task ownership, OpenSpec 22/22,
  offline, provenance, secrets, workflow hygiene, dependency audit, generated
  registry, and runtime-QA contract validators: **PASS**.
- Native Android build/install, 14-surface light/dark after matrix, actual
  Home-to-tutorial-to-live-board flow, automated accessibility, and fresh
  logcat: **PASS** as detailed in the linked evidence.

The four workflows triggered by the source checkpoint were all classified
**FAILED BEFORE EXECUTION / EXTERNAL**: Repository Integrity `35267217853`,
Android Build Smoke `35267217680`, App CI `35267217667`, and iOS Build Smoke
`35267217596`. Each job had an empty step list; no workflow was edited and no
CI success was inferred.

