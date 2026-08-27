# Proposal — Campaign 016 Release Certification & Hardening

## Decision

Run a **Codebase Hardening + Release-Certification Campaign**, not another feature-expansion campaign.

The repository already has a mature 42-game product, Workout V3, persistence, progression, achievements, quests, rewards/cosmetics, analytics, backup/data portability, governance validators, a large automated test corpus, and an Android certification harness. Current `main` is green in both GitHub workflows at audit baseline `1b5802d62447c44e58d0f0bdb36ada740b05d023`.

The highest-value remaining work is evidence closure and production-hardening, not more breadth.

## Verified audit findings at baseline

1. **Exact-head CI is green.** GitHub App CI run `33105102260` and Repository Integrity run `33105102351` both completed successfully on `1b5802d`.
2. **Automated product coverage is broad.** The repository contains 1,777 tracked files, 42 `game.json` modules, and 495 test files. Current App CI reports 487 passed suites / 6,031 passed tests, with 4 skipped suites / 5 skipped tests.
3. **Current web/tooling gates are green.** App CI passes durable-state validation, generated registry check, provenance drift check, task ownership, offline-boundary validation, QA harness self-test, `npm ci`, TypeScript, lint, Jest, web export, and Expo Doctor (21/21).
4. **Campaign 015 implementation is materially present.** Rule Grid chained deduction, Word Chain 90-chain expansion, Context Fit 180-item expansion, Transform Match final-boundary validation, governance binding, performance probes, and targeted accessibility work are documented in the terminal checkpoint and reflected in source/test topology.
5. **Campaign 015 lifecycle is not truthfully closed.** A terminal file named `.agent/checkpoints/015-governance-depth-convergence-COMPLETED.md` exists, but `.agent/GOVERNANCE.json`, `.agent/CURRENT_CAMPAIGN.md`, `.agent/STATE.md`, and `openspec/changes/015-governance-depth-convergence/change.json` still declare 015 ACTIVE. The 015 task file also contains many unchecked items despite the checkpoint claiming those implementations and validations are complete.
6. **Current-head Android device evidence is incomplete.** The repository records prior definitive 42/42 Android certification at Campaign 013 and later targeted green journeys, but post-014/015 changed-surface re-runs are explicitly NOT VALIDATED because the dedicated Android emulator on the Windows/WHPX host segfaults after boot.
7. **iOS remains source-compatible but NOT VALIDATED.** The project targets iOS, but no current iOS build proof exists because the primary host is Windows and has no Xcode/macOS.
8. **CI signal is green but noisy.** Current Jest output includes intentional `console.error` emissions from failure-path tests, 4 skipped suites / 5 skipped tests, Node deprecation warnings from transitive tooling, and a GitHub runner warning that v4 actions target Node 20 while the runner forces Node 24.
9. **Store-release engineering is intentionally deferred.** There is no `eas.json` and app identifiers/versioning remain development-oriented. This is not a blocker for this campaign because the locked constitution explicitly defers store release engineering, final branding, monetization, auth/cloud, AI, social, and final public-release OS policy.

## Verified vs. unverified evidence policy

### VERIFIED
- Exact current-head GitHub workflow conclusions.
- Source topology and file counts.
- Current package/config/workflow contents.
- Current lifecycle declarations and the contradictory 015 COMPLETED checkpoint.
- Current CI test summary, skips, warnings, web export and Doctor result.
- Repository-declared prior Android certification artifacts and current NOT VALIDATED status.

### IMPLEMENTED / INSUFFICIENTLY VALIDATED
- Post-015 Android runtime behavior on the changed gameplay/workout surfaces.
- iOS native compilation.
- Manual system-sheet flows (SAF/share/document picker).
- 60/120 Hz timing behavior on representative physical hardware.
- Current-head clean native Android prebuild/release build from a fresh checkout.

### INTENTIONALLY DEFERRED / NOT A DEFECT
- Supabase/auth/cloud sync.
- AI assistant production implementation.
- Monetization, ads, pricing, purchases.
- Social/multiplayer.
- Notifications/widgets.
- Store listing/signing/release operations.
- Final public-release OS floors and branding.

## Objective

Convert the mature implementation into an evidence-backed, reproducible release candidate by closing lifecycle truth, proving clean-checkout reproducibility, restoring fresh Android device certification, obtaining iOS build-smoke evidence, improving CI/test signal integrity, and hardening failure/recovery paths without expanding product scope.

## Completion definition

016 is complete only when:
- 015 is durably and machine-consistently closed before 016 activation;
- clean-checkout install/build/test/reproducibility is demonstrated;
- current-head Android certification is fresh or a genuinely external blocker is proven with bounded evidence;
- iOS build-smoke is automated or explicitly blocked by a documented infrastructure limitation that cannot be removed in-repo;
- unexpected test skips/console noise are fail-closed or explicitly allowlisted;
- no unresolved Critical/High product defect remains;
- required release-candidate docs/state are synchronized to exact green SHAs.
