# Campaign 053 hardening exploration

## Charter and evidence boundary

This is the evidence record for the Campaign 053 "explore first, propose
second, implement nothing" hardening campaign. It was conducted against
`12f9cf7f6354c12f0392cc2b4c65bc2a2fde84be`; that commit is documentation-only
relative to the Campaign 051 product baseline. No application source,
dependency, schema, or production-test implementation was changed while
creating this record.

Evidence was ranked in this order: current repository source and lockfile,
deterministic local validation, a local Android assembly, bounded emulator
observation, then historical campaign artifacts and remote CI metadata. A
historical symptom is not treated as a current defect unless current evidence
reproduces it.

## Audit methods and baseline

- Read the constitution, governance, active-goal/campaign state, known issues,
  validation history, Campaign 053 charter, recent history, and remote state.
- Ran repository state, ownership, affected-area, registry, offline, secret,
  dependency-policy, runtime-QA-contract, workflow-hygiene, and Jest-signal
  validators. They passed at the baseline.
- Restored the lockfile installation with `npm ci`; `expo install --check` and
  `expo-doctor` both reported the project aligned (21/21 doctor checks).
- Ran TypeScript checking, linting, and the full CI test command. All passed:
  559 passed suites of 563 total, 6,575 passed tests of 6,580 total, and five
  snapshots. Four suites/five tests are intentionally opt-in performance
  probes, not ordinary skipped functional coverage.
- Assembled `:app:assembleDebug --no-daemon` locally. It passed after 10m 26s.
  Third-party/toolchain deprecation messages, an SDK XML-version warning, an
  unset `NODE_ENV` fallback, and Windows cross-volume hard-link fallbacks were
  warnings rather than application build failures.
- Used ARTEMIS diagnosis and a read-only, emulator-local hierarchy/screenshot
  observation on the designated Android 15 emulator. ARTEMIS was ready (5/5
  checks) and the Home screen rendered a persisted completed workout. This was
  not an install, test journey, or exact-build-identity assertion.
- Inspected the four current remote CI failures. Each failed before executing a
  step (empty step lists), so this campaign cannot attribute them to app code
  or propose a workflow-file change as a cure.

## Confirmed findings

| ID | Rank | Finding | Current evidence | Bounded response |
| --- | --- | --- | --- | --- |
| H-01 | Medium | Bootstrap can report ready after a foundational post-initialization failure. | `apps/mobile/src/app/_layout.tsx` combines registry registration, progression initialization, profile/theme/audio reads in one catch-all block, logs an error, then marks the shell ready. Existing storage-unavailable coverage exercises database initialization failure, not independently injected post-initialization failures. | Specify staged bootstrap status, retry/relaunch convergence, and an honest user-visible safe/degraded state when registry or progression integrity is unavailable. Keep cosmetic preference failures independently nonfatal. |
| H-02 | Medium, preventative security debt | A production-reachable router transitive dependency remains an accepted ReDoS advisory. | A fresh production-only audit reports 20 advisories (15 moderate, 5 high, no critical). `decode-uri-component` is reachable through `expo-router -> query-string`; the repository allowlist and known-issues record already classify it as accepted runtime debt expiring 2026-12-31. The only audit-suggested direct move is an unsafe Expo Router major downgrade. | Require an Expo-compatible remediation decision before changing the lockfile. Evaluate a narrow route input envelope only as defense in depth, explicitly not as a claim to remediate parser work that occurs upstream. |
| H-03 | Medium | Passing tests still emit uncontrolled asynchronous-test and console noise. | The full suite emitted repeated missing/overlapping `act(...)` warnings, animation updates outside `act`, a deprecated Testing Library timeout-option warning, and expected persistence exceptions printed without a harness distinction. The suite still passes. | Establish a bounded signal-hygiene baseline: repair known async patterns and distinguish explicitly asserted error paths from unexpected console output before adding a reliable failure gate. |
| H-04 | Medium, preventative | Catalog persistence failure behavior is proven dynamically for one representative game, not the full catalog. | There are 42 game `session.ts` modules with per-game persistence wrappers. The existing host failure test deliberately covers shared results plus one representative game; catalog contracts mostly source-scan persistence tokens. Individual screen/session tests exist, so this is a breadth-of-contract gap, not evidence that the other games fail. | Add a table-driven catalog contract using existing injected persisters/fixtures and explicit exemptions, preserving game mechanics, raw result shapes, scoring, and generator versions. |

## Evidence gaps and non-findings

- No current Critical or High product defect was reproduced. The historic Expo
  SQLite `NativeDatabase.prepareAsync` NPE was investigated and repaired in
  Campaign 042 through connection isolation, initialization coalescing, and
  serialized native access; current focused coverage and later release
  relaunch evidence make a rewrite unjustified.
- Local runtime observation is useful render evidence but has no app build
  identity marker. It cannot certify the exact source commit, release signing,
  iOS, physical/OEM Android behavior, system document/share sheets, TalkBack,
  VoiceOver, or store distribution.
- Campaign 052's visual review identifies meaningful visual-system debt, but it
  does not establish a correctness defect in the current hardening scope. The
  full-completion progress bar observed on Home is intentional, source-backed
  UI state rather than a defect.
- The portability and transactional persistence paths already have strong
  validation, including validation, checksums, transaction guards, rollback,
  merge/replace, and large-fixture coverage. A data-layer rewrite would add
  risk without evidence.
- Remote CI cannot be certified from the current zero-step failures. This is an
  external evidence boundary, not a basis to change workflow definitions.

## Candidate implementation slices

1. **Bootstrap integrity and recovery** — serial first, because other work
   depends on an honest normal/degraded app shell.
2. **Dependency decision and route boundary** — isolated lockfile/security
   investigation, only if an official compatible remediation exists.
3. **Test signal integrity** — may proceed in parallel with slice 2 after the
   baseline is captured; no blanket warning suppression.
4. **Catalog persistence failure contract** — may proceed in parallel with
   slice 3; use a generated/discoverable all-game matrix rather than hand-waved
   representative coverage.
5. **Convergence evidence** — serially run affected validation and a bounded
   Android emulator-local release/debug journey after implementation. Manual
   platform and remote-CI gaps remain explicitly NOT VALIDATED where access is
   unavailable.

## Rejected work

- No broad SQLite/data-portability rewrite.
- No second runtime controller or host-input automation.
- No blind dependency downgrade, arbitrary audit allowlisting, or fake claim
  that route-local validation removes upstream decoder risk.
- No full visual redesign, gameplay/scoring rebalance, schema migration, or
  CI-workflow rewrite inside this hardening change.
