# Spec — validation-security-gates

## ADDED Requirements

### Requirement: Expiry single-source-of-truth and renewal ownership

Every accepted-debt or temporary-waiver expiry SHALL have exactly one
date value consistent across its durable-state documentation and its
machine-readable allowlist, and SHALL name the renewal owner/trigger.
Validators SHALL fail closed when a waiver is expired, and SHALL report
(without failing) waivers approaching expiry.

#### Scenario: Documentation matches the machine-readable expiry

- GIVEN the ReDoS accepted-debt waiver
- WHEN its expiry is read from `.agent/KNOWN_ISSUES.md`,
  `.agent/DEPENDENCY_AUDIT.md`, and the dependency-audit allowlist
- THEN all three state the same date (`2027-03-31`) and name the
  renewal trigger.

#### Scenario: Expired provenance waiver fails the freshness check

- GIVEN a provenance allowlist entry whose `expires` is in the past
- WHEN the provenance validator's allowlist freshness check runs
- THEN it exits non-zero and names the expired path.

#### Scenario: Near-expiry waiver warns without failing

- GIVEN a provenance allowlist entry expiring inside the warning window
- WHEN the freshness check runs
- THEN it prints a warning and exits zero.

### Requirement: Jest skip allowlist carries per-entry expiry

Every jest-skip allowlist entry SHALL carry an `expires` date in
addition to its owner/review metadata. The validator SHALL reject a
missing or malformed expiry, fail on an expired entry, warn on an
entry approaching expiry, and expose a summary-free `--check-allowlist`
mode for scheduled CI use.

#### Scenario: Entry without expiry is rejected

- GIVEN an allowlist entry missing `expires`
- WHEN the allowlist schema is validated
- THEN validation fails naming the entry.

#### Scenario: Expired entry fails closed

- GIVEN an allowlist entry whose `expires` has passed
- WHEN `--check-allowlist` runs
- THEN the command exits non-zero and the entry is reported.

#### Scenario: Shipped allowlist is fresh

- GIVEN the repository's allowlist
- WHEN `--check-allowlist` runs
- THEN every entry parses, is unexpired, and is not stale; orphan
  detection stays enforced by the summary mode, which matches entries
  against a real Jest result.

### Requirement: Affected-area map covers every major source area

`scripts/validate-affected.mjs` SHALL define rules for analytics,
quests, achievements, streaks, and theme source trees, mirrored
pattern-for-pattern in `.agent/IMPACT_MAP.md`; the script SHALL
self-test its glob, directory-prefix, unmatched, and `--strict` exit
semantics; and `--strict` behavior SHALL be documented for orchestrator
use.

#### Scenario: New areas map to checks

- GIVEN a changed path under `apps/mobile/src/analytics`,
  `apps/mobile/src/quests`, `apps/mobile/src/achievements`,
  `apps/mobile/src/streaks`, or `apps/mobile/src/theme`
- WHEN the affected-area plan is built
- THEN each path matches an area with concrete light-validation checks.

#### Scenario: Strict mode fails on an unmatched path

- GIVEN a path that matches no rule
- WHEN `--strict` is used
- THEN the process exits 1 and prints the unmatched path.

#### Scenario: Self-test and sync check pass

- GIVEN the rule table and the IMPACT_MAP mirror
- WHEN `--self-test` and `--check-sync` run
- THEN both pass with no drift.

### Requirement: Console signal gate covers all console levels

The unexpected-console gate SHALL guard `console.error`, `console.warn`,
`console.log`, `console.info`, and `console.debug`. Deliberate emitters
SHALL be scoped with `expectConsoleNoise` (which asserts the message
actually occurred) rather than muted, and the reviewed baseline SHALL
remain empty.

#### Scenario: Unexpected log output fails the producing test

- GIVEN a test that calls `console.log` without scoping
- WHEN the test finishes
- THEN the gate fails that test and names the message.

#### Scenario: Scoped output is deliberate

- GIVEN a test that exercises a deliberate log/error path
- WHEN it wraps the call in `expectConsoleNoise`
- THEN the message is allowed, counted, and the test passes only if the
  message actually occurred.

#### Scenario: Guard state resets per test

- GIVEN a test that emitted scoped noise
- WHEN the next test starts
- THEN no expectation or violation leaks across the boundary.

### Requirement: Secret scanner covers additional high-confidence formats

The tracked-file secret scanner SHALL detect npm tokens, Google API
keys, and Stripe live/restricted secret keys in addition to its existing
patterns, with offline self-tests proving each new pattern and its
negative control, and the tracked-tree scan SHALL stay clean.

#### Scenario: New formats are detected

- GIVEN synthetic npm, Google API, and Stripe live key strings
- WHEN the scanner self-test runs
- THEN each produces exactly its named pattern match.

#### Scenario: Ordinary prose stays clean

- GIVEN documentation mentioning keys without a real format
- WHEN the scanner runs
- THEN no finding is produced.

### Requirement: Offline boundary covers module specifiers and runtime ban parity

The offline static scan SHALL flag banned network package specifiers
(`axios`, `expo/fetch`, `expo-network`, `node-fetch`, `cross-fetch`,
`undici`, `got`, `superagent`) in static imports, `require`, and dynamic
imports, not only bare identifiers. The in-jest runtime ban SHALL patch
every network global the Node environment exposes (`fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource`) plus
`navigator.sendBeacon`, and the remaining non-patchable boundary
(imported libraries) SHALL be documented as covered by the static scan.

#### Scenario: Specifier-only import is flagged

- GIVEN `import { get } from 'axios'` with no other axios identifier
- WHEN the static scan runs
- THEN the line is reported as a violation.

#### Scenario: Runtime ban throws on EventSource use

- GIVEN the runtime ban is installed
- WHEN application code constructs an `EventSource`
- THEN the call throws the offline-test error.

#### Scenario: Allowed call sites remain clean

- GIVEN the shipped source tree
- WHEN the scanner and its self-test run
- THEN there are zero unallowlisted hits.

### Requirement: Probe runner covers all opt-in probes

`scripts/perf/run-probes.mjs` SHALL execute every opt-in measurement
probe (baseline, sync scan, quest A/B, projection differential, large
backup), each with its own enablement environment, capture its JSON
marker into a timestamped baseline, and list the coverage on request.

#### Scenario: Coverage is complete

- GIVEN the runner's list mode
- WHEN it runs
- THEN all five probes are listed with their enable switches.

#### Scenario: A missing marker fails the run

- GIVEN a probe that produces no marker line
- WHEN the runner executes it
- THEN the run reports the failure for that probe and exits non-zero.

### Requirement: Runtime-QA contract validates structure, not strings

The runtime-QA contract check SHALL parse `apps/mobile/app.json` and
assert the scheme value structurally, resolve every `braintraining://`
deep link documented in `docs/ARTEMIS_ANDROID_QA.md` against an actual
route file (including dynamic-route handling), and assert the testID
seam's exported helpers, with an offline self-test for the resolution
logic.

#### Scenario: Documented deep link resolves

- GIVEN the documented `braintraining://game/<id>` link
- WHEN the contract check runs
- THEN the resolver finds the matching `src/app/game/[id].tsx` route.

#### Scenario: Broken documentation fails closed

- GIVEN a documented deep link with no matching route
- WHEN the check runs
- THEN it fails naming the link.

### Requirement: Jest testMatch cannot silently ignore spec tests

Jest's `testMatch` SHALL include both `*.test.ts(x)` and `*.spec.ts(x)`
patterns, and a guard test SHALL fail if either naming convention loses
coverage.

#### Scenario: Spec-named file is matched

- GIVEN the app jest configuration
- WHEN the guard test inspects `testMatch`
- THEN both `.test` and `.spec` patterns for `ts`/`tsx` are present.

### Requirement: Android APK permission gate is deny-by-default

The Android build smoke gate SHALL compare the packaged APK's
`uses-permission` set against a committed expected set and fail on any
undeclared permission, in addition to the existing blocked-permission
assertions.

#### Scenario: Undeclared permission fails

- GIVEN an APK declaring a permission absent from the expected set
- WHEN the gate step runs
- THEN the step exits non-zero and names the permission.

#### Scenario: Expected set passes

- GIVEN the certified permission set
- WHEN the gate step runs
- THEN the set matches and the existing blocked-permission checks still
  pass.

### Requirement: New gates are wired into CI with documented ownership

The repository-integrity workflow SHALL run the new validator
self-tests and allowlist freshness checks on push and on the weekly
schedule. Network-dependent gates (npm audit) SHALL remain owned by
that workflow with the ownership documented; the hermetic App CI job
SHALL NOT gain a network-dependent gate.

#### Scenario: Scheduled checks are real

- GIVEN the repository-integrity workflow
- WHEN its steps are inspected
- THEN the allowlist freshness checks and new self-tests are present,
  and the weekly-schedule comment names what the schedule catches.

#### Scenario: App CI stays hermetic

- GIVEN the App CI workflow
- WHEN its steps are inspected
- THEN no network-dependent audit step was added, and the audit's real
  owner (repository-integrity) is named in comments.

## MODIFIED Requirements

None.

## REMOVED Requirements

None.
