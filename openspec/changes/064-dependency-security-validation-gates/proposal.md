# Change 064 — Dependency and Security Validation Gates

**Status:** IN_PROGRESS
**Predecessor:** `063-release-candidate-runtime-matrix` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 062–064 release resilience and platform robustness.

## Problem / evidence

The 056–067 program census (7 read-only lanes, base `428d293`) found the
repository-owned validation/diagnostic gates sound but incomplete. Each
claim below was re-verified against HEAD before this spec was written:

1. **Expiry contradiction / silent time-bombs.** `KNOWN_ISSUES.md` states
   the accepted ReDoS debt expires `2026-12-31` while
   `scripts/certification/dependency-audit-allowlist.json` says
   `2027-03-31`; `DEPENDENCY_AUDIT.md` agrees with the allowlist, so the
   durable-state doc is the stale copy. The provenance allowlist
   (`.agent/provenance-allowlist.json`) expires `2026-11-11`; the
   validator only ignores expired entries when the file happens to be in
   a diff — no freshness check reports an expired or near-expiry entry.
   The five jest-skip allowlist entries have no expiry at all.
2. **Affected-area map gaps.** `scripts/validate-affected.mjs` has no
   rule for `src/analytics`, `src/quests`, `src/achievements`,
   `src/streaks`, or `src/theme` (all verified present), so edits there
   print "no area rule matches" and `--strict` is used nowhere.
3. **Console gate is error/warn-only.** `jest/setup.js` installs a guard
   on `console.error`/`console.warn`; `console.log`/`info`/`debug` are
   unguarded. Nine deliberate call sites exist (seven test emitters, one
   dead debug print, one `[perf]` source emitter that DOES fire under jest
   because `__DEV__` is true in the jest-expo environment — the census's
   initial "inert" assumption was falsified by the full matrix during
   adversarial review, and the emitter is now suppressed under jest only,
   with device logging unchanged).
4. **Scanner gaps.** `validate-secrets.mjs` covers six provider formats
   and would miss an npm token, a Google API key, or a Stripe live key.
   `validate-offline.mjs` matches identifiers on string-stripped code, so
   `import { get } from 'axios'` is invisible; the runtime ban in
   `offline-boundary.test.ts` patches only `fetch`/`XMLHttpRequest`/
   `WebSocket`.
5. **Probe coverage.** Five opt-in probes exist; `scripts/perf/run-probes.mjs`
   runs two (`perf-baseline`, `perf-sync-scan`).
6. **Runtime-QA contract is string-presence only.**
   `scripts/qa/validate-runtime-qa-contract.mjs` asserts a literal
   `"scheme": "braintraining"` substring and file existence; it never
   parses `app.json`, never checks that a documented deep link resolves
   to an actual route, and has no self-test.
7. **testMatch/spec agreement.** Jest `testMatch` accepts only
   `*.test.ts(x)`; a `*.spec.ts` test would silently never run (none
   exists today, so this is latent).
8. **Android smoke permission check is deny-two, not deny-by-default.**
   `android-build-smoke.yml` rejects only RECORD_AUDIO and
   SYSTEM_ALERT_WINDOW. The 063 APK declares seven platform
   `uses-permission` entries plus the app's own dynamic-receiver
   permission (dumped with aapt2 at HEAD): INTERNET,
   MODIFY_AUDIO_SETTINGS, READ_EXTERNAL_STORAGE (maxSdk 32), VIBRATE,
   WRITE_EXTERNAL_STORAGE (maxSdk 32), ACCESS_NETWORK_STATE, WAKE_LOCK,
   com.braintraining.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION — a
   new permission would pass silently.
9. **Network-gate ownership is undocumented.** The production dependency
   audit (network-dependent, can be BLOCKED) runs on the
   repository-integrity workflow; App CI is hermetic. That division is
   correct but undocumented, which made it read as an audit gap.

## Desired invariant / outcome

- Every expiry waiver has one value, consistent across durable-state and
  machine-readable sources, with a named renewal owner; validators fail
  closed on expired entries and report near-expiry entries.
- The affected-area map covers every major source area and is enforced by
  a self-test; `--strict` semantics are pinned and documented.
- The console signal gate covers all four console levels; the deliberate
  emitters are scoped, and the baseline stays empty.
- Static secret/offline gates cover the formats and module-specifier
  bypasses that are identifiable without guessing; the offline runtime
  ban is as wide as the environment allows, with the remaining
  non-patchable boundary documented.
- The probe runner covers all five opt-in probes; the runtime-QA contract
  validates structure and route resolution; Jest's testMatch cannot
  silently ignore a spec-named test; the Android permission gate is
  deny-by-default.
- New checks are wired into CI where they can actually run; the
  network-dependent audit's ownership is written down.

## Non-goals

- No product behavior change. The one product-source edit
  (`sdk/perf.ts` suppresses its `[perf]` log line only when
  `JEST_WORKER_ID` is set) is test-runner-only: device and dev-build
  logging is byte-identical, and the in-process perf ring buffer is
  untouched.
- No dependency upgrade/downgrade; the ReDoS advisory envelope is
  unchanged (only its documented expiry is aligned).
- No extension of provenance identity scope beyond `games/<id>`
  (registry reproducibility is guarded separately by
  `generate-game-registry.mjs --check`; documentation records this).
- No fix for the Jest SQLite backend vs production native adapter
  divergence (architectural; on-device certification is the compensating
  evidence).
- No attempt to make the network-dependent npm audit part of the
  hermetic App CI job; no new workflow file.
- No `allowBackup`/manifest product change (that surface belongs to the
  post-067 hardening phase if evidence demands it).

## Affected areas

- Scripts: `validate-secrets.mjs`, `validate-offline.mjs`,
  `validate-provenance.mjs`, `validate-affected.mjs`,
  `certification/validate-jest-signal.mjs`, `perf/run-probes.mjs`,
  `qa/validate-runtime-qa-contract.mjs`,
  `certification/jest-skip-allowlist.json`,
  `.agent/provenance-allowlist.json`, new `scripts/android/` expected
  permission data.
- Test layer: `jest/setup.js`, `test-utils/console-signal.ts`, six
  deliberate console emitters, `offline-boundary.test.ts`, a new
  console-signal contract test, a new jest-config guard test,
  `apps/mobile/package.json` (`jest.testMatch` only).
- Docs/state: `.agent/IMPACT_MAP.md`, `.agent/KNOWN_ISSUES.md`,
  `.agent/DEPENDENCY_AUDIT.md` (renewal ownership).
- CI: `.github/workflows/repository-integrity.yml`,
  `.github/workflows/android-build-smoke.yml`.

## Protected contracts

All product behavior, schema v12, scoring/economy, routing, the empty
unexpected-console baseline (an emitter is scoped, never muted), the
fail-closed nature of every existing validator, and the repository's
offline/host-input boundaries.

## Implementation plan

1. Align the ReDoS expiry (+ renewal owner) across durable state.
2. Add expiry schema + freshness mode to the provenance and jest-skip
   validators; extend tests.
3. Add affected-area rules for analytics/quests/achievements/streaks/
   theme; mirror in IMPACT_MAP; add `--self-test`.
4. Guard all console levels; scope the deliberate emitters; add a
   console-signal contract test.
5. Extend secret patterns and offline module-specifier detection;
   align the runtime ban; extend self-tests.
6. Extend the probe runner to all five opt-in probes.
7. Make the runtime-QA contract structural (app.json parse, deep-link →
   route resolution, testID seam) with a self-test.
8. Include `.spec.ts(x)` in testMatch and add a config guard test; add
   the deny-by-default APK permission gate.
9. Wire the new checks into CI and document audit ownership.
10. Full terminal validation, adversarial review, durable-state
    reconcile, commit/push.

## Test plan

- Every changed validator runs its own `--self-test` (and the new
  freshness modes) offline.
- `node scripts/validate-affected.mjs --check-sync` and the new
  `--self-test` pass; the IMPACT_MAP mirror is byte-consistent.
- The console-signal contract test proves all-level guarding,
  expectConsoleNoise scoping, and per-test reset.
- The jest-config guard test proves `.test` and `.spec` glob coverage.
- Full Jest matrix (must stay green with zero unexpected console output),
  typecheck, lint, Expo Doctor, repo-state, task-ownership, OpenSpec
  `--all --strict`, secrets scan, offline scan, provenance self-test,
  and the certification bundle of validators.

## Runtime/native evidence plan

The APK permission gate is validated by running the same aapt2 comparison
locally against the 063 artifact (8 entries: 7 platform permissions plus
the dynamic-receiver permission) and by the workflow
diff. No emulator interaction is required; if a console-gate repair
touches a runtime component, the existing emulator lane is used and the
result recorded. Evidence lives under `docs/redesign/evidence/campaign064/`.

## Rollback / risk notes

- Validator strictness increases: an unexpected near-expiry warning must
  not fail a green run (warn ≠ fail). Expired entries fail closed.
- Guarding `console.log` could surface latent test noise; the full matrix
  is the gate, and each surfaced emitter is scoped, never muted.
- testMatch widening cannot change behavior while no `.spec.*` file
  exists; the guard test pins the agreement.
- The permission gate is CI-only; a deliberate future permission addition
  must update the expected-set file in the same change.

## Completion criteria

Standard terminal bar: focused + full validation green
(Jest/typecheck/lint/Expo Doctor/OpenSpec strict/repo-state), every new
check wired and passing, no unexpected console output, adversarial review
closed, durable state updated, committed and pushed with
`HEAD == origin/main`, and the 064 evidence record written.
