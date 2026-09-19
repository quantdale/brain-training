## 1. Bootstrap integrity and recovery

- [ ] 1.1 Map current startup stages into foundational and ancillary classes, including their durable side effects and existing retry/idempotency guarantees.
- [ ] 1.2 Replace the combined post-initialization ready path with explicit classified bootstrap outcomes and an honest recovery-safe UI state for foundational failures.
- [ ] 1.3 Add a deterministic retry and cold-relaunch recovery path that cannot duplicate catalog registration, progression seeding, currency, or other durable effects.
- [ ] 1.4 Preserve nonfatal ancillary preference behavior with a safe fallback and stage-specific diagnostics.
- [ ] 1.5 Add isolated fault-injection coverage for catalog registration, progression initialization, and one ancillary preference stage; verify ready, safe, retry, and relaunch outcomes.
- [ ] 1.6 Run the startup-related affected validators and unit/integration tests before opening parallel hardening slices.

## 2. Dependency decision and route boundary

- [ ] 2.1 Reproduce the production dependency reachability path and evaluate officially supported Expo-compatible remediation options for the accepted router advisory.
- [ ] 2.2 If a compatible remediation exists, land it in an isolated dependency/lockfile change and run Expo compatibility, audit-policy, type, test, and native-build checks.
- [ ] 2.3 If no compatible remediation exists, retain or renew only a time-bounded machine-readable disposition with current reachability, expiry, and re-evaluation evidence; do not downgrade blindly.
- [ ] 2.4 Confirm the app-owned route boundary that receives game/session parameters and define canonical forms and bounds from the existing catalog/session contract.
- [ ] 2.5 Implement and test safe rejection of malformed or oversized app-owned route inputs without changing persistence or progression, documenting that it is defense in depth rather than upstream decoder remediation.

## 3. Automated test signal integrity

- [ ] 3.1 Baseline every known `act`, overlapping-action, animation, deprecated-query, and expected-error console message from the standard test command with an owning test or harness location.
- [ ] 3.2 Repair affected asynchronous UI tests using supported synchronization and remove the known deprecated query invocation.
- [ ] 3.3 Add narrow, restored expected-error assertions for deliberate persistence/recovery failure tests without globally muting console output.
- [ ] 3.4 Introduce a reviewable unexpected-console signal gate only after the known baseline is clean, with no broad warning allowlist or retry-based masking.
- [ ] 3.5 Record intentional performance-probe enable conditions separately from functional-test coverage and verify standard CI output remains truthful.

## 4. Catalog persistence-failure contract

- [ ] 4.1 Build a registry-derived catalog matrix that detects every currently registered game and rejects untracked additions.
- [ ] 4.2 Reuse existing injected persister/fixture seams to exercise success, rejected-save, and stale-completion behavior for each non-exempt game.
- [ ] 4.3 Add an explicit exemption mechanism requiring game identity, reason, and deterministic alternate success/failure/stale-completion evidence.
- [ ] 4.4 Assert that rejected or stale completion cannot duplicate durable session history, progression, currency, or workout advancement and leaves an honest recoverable result state.
- [ ] 4.5 Run the matrix against the full registry and retain lightweight representative canaries for fast affected-area feedback.

## 5. Convergence, runtime evidence, and durable state

- [ ] 5.1 Select and run required checks through `.agent/IMPACT_MAP.md`, including repository state, dependency-policy, affected tests, full suite, typecheck, lint, and applicable catalog/startup validators.
- [ ] 5.2 Assemble the Android artifact that contains the implemented changes and record build identity with the validation result.
- [ ] 5.3 Run an emulator-local ARTEMIS/ADB-safe startup, failure-recovery, and representative completion journey on the one dedicated AVD without host-input automation.
- [ ] 5.4 Record iOS, physical/OEM Android, assistive technology, store-signing, system-sheet, and zero-step remote-CI boundaries as NOT VALIDATED unless actual evidence becomes available.
- [ ] 5.5 Update campaign/governance/validation/known-issue durable records at the implementation checkpoint, commit coherent slices, push buildable `main`, and preserve no abandoned worktrees.
