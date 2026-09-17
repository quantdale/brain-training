# Campaign 030B — Runtime Validation Infrastructure Unblock

**Status:** READY FOR EXECUTION  
**Mode:** test-environment recovery, native rendering validation, dynamic-flow verification, and readiness closure  
**Product redesign authorization:** **NONE**  
**Product-source authorization:** **NONE by default**  
**Repository:** `quantdale/brain-training`  
**Campaign 030 final evidence commit:** `0d272dd0e4772f985b33c5d61dccf972723adea9`  
**Campaign 029 product baseline:** `5c484a08083963439360cb06c229249029f90531`  
**Primary output:** `docs/redesign/REDESIGN_READINESS_REPORT.md` updated with Campaign 030B closure evidence, plus `docs/redesign/evidence/campaign030b/**`

---

## 0. Mission

Campaign 030 correctly returned `BLOCKED_NOT_READY`. It established that the application can install, bootstrap, load JavaScript, expose populated native accessibility trees across the route matrix, and satisfy local repository gates. It also established two validation blockers:

1. the disposable AOSP ATD image produces a populated hierarchy but a uniform-black framebuffer with zero rendered frames even under multiple GPU modes; and
2. the existing ARTEMIS live-flow path is blocked by an unavailable authorized provider credential.

Campaign 030B exists to remove those validation blockers **without beginning the redesign**.

This campaign is deliberately narrower than Campaign 030. Do not re-audit the entire product from scratch. Use Campaign 029 and Campaign 030 as existing evidence. Your job is to obtain a trustworthy current native visual baseline and trustworthy current dynamic golden-path evidence using a better disposable runtime and, where necessary, an explicitly authorized deterministic alternative to the blocked ARTEMIS provider route.

The desired outcome is a binary, evidence-backed decision:

- `READY_FOR_CAMPAIGN_031`, or
- `BLOCKED_NOT_READY` with one or more precisely isolated blockers that cannot reasonably be closed in this environment.

Campaign 031 must not be started by this session.

---

## 1. Mandatory read order

Before changing the test environment, read at minimum:

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. all applicable repository/local agent instructions under `.agent/**`, `.agents/**`, `.claude/**`, `.opencode/**`, or equivalent locations
4. `.agent/CAMPAIGN029_PRODUCT_REDESIGN_DISCOVERY_PROMPT.md`
5. `.agent/CAMPAIGN030_RUNTIME_BASELINE_READINESS_PROMPT.md`
6. `docs/redesign/PRODUCT_REDESIGN_MASTER_PLAN.md`
7. `docs/redesign/REDESIGN_READINESS_REPORT.md`
8. `docs/redesign/evidence/campaign030/RUNTIME_MATRIX.md`
9. `docs/redesign/evidence/campaign030/SCREENSHOT_INDEX.md`
10. `docs/redesign/evidence/campaign030/ENVIRONMENT_DIAGNOSIS.md`
11. `docs/redesign/evidence/campaign030/CI_AND_SDK_CLASSIFICATION.md`
12. `docs/redesign/evidence/campaign030/HUMAN_VALIDATION_HANDOFF.md`
13. the Android automation/runtime documentation and scripts actually used by this repository.

Do not assume historical statements remain current. Reuse prior evidence where valid, but verify the exact current checkout and exact runtime used in this campaign.

---

## 2. Non-negotiable safety rules

### 2.1 Never touch user-owned devices or emulators

Do **not** stop, cold-boot, wipe, uninstall from, install to, relaunch, send input to, or otherwise modify any pre-existing user-owned Android device/emulator.

At minimum, treat the following as protected unless the repository explicitly proves they are disposable and campaign-owned:

- `emulator-5554`
- `braintraining-ui35`
- any emulator/device already running before this campaign
- any physical phone attached through ADB

Before every destructive emulator operation, positively identify the target AVD and process as Campaign-030B-owned.

### 2.2 A new disposable runtime is explicitly authorized

Unlike Campaign 030, this campaign **is authorized** to create, configure, boot, wipe, replace, and delete a new dedicated Campaign-030B Android Virtual Device for validation purposes.

Prefer a normal phone-oriented Android system image that can publish real pixels. Do **not** reuse the prior ATD image merely because it already exists.

Suggested naming:

`braintraining-c030b`

Use a currently installed or reasonably installable stable Android API level compatible with the project. Prefer a normal Google APIs or standard AOSP phone image over ATD/headless test images.

The goal is visual fidelity and deterministic automation, not CI density.

### 2.3 Product redesign remains prohibited

Do not change:

- product UI hierarchy
- app routes for redesign reasons
- copy for redesign reasons
- theme/tokens for redesign reasons
- gameplay mechanics
- workout selection logic
- rewards/economy behavior
- persistence/schema
- scoring/provenance
- product dependencies merely to improve appearance

If a product-code defect genuinely prevents the current baseline from launching or rendering on a standard supported runtime, document it first. Do not silently fix it. A product-code change requires a separately justified blocker classification and must remain the smallest possible non-redesign repair if repository policy explicitly permits it. Default behavior is **no product-source change**.

### 2.4 Test-environment changes are allowed

You may change or create, outside product behavior:

- disposable AVD definitions
- emulator launch flags
- local Android SDK images/tools required for the disposable runtime
- temporary ADB/Metro port reversals
- temporary local test fixtures already supported by the repository
- external temp directories for screenshots/logs
- campaign evidence documentation

Do not commit machine-specific SDK/AVD artifacts.

### 2.5 Do not weaken validation

Do not turn failures into passes by disabling checks, removing assertions, skipping required states, or relabeling unavailable evidence.

`NOT VALIDATED`, `BLOCKED`, and `EXTERNAL` are acceptable outcomes when truthful.

---

## 3. Campaign start and repository synchronization

Safely synchronize the local checkout with remote `main`.

Requirements:

- preserve all pre-existing local user work;
- never use destructive reset/clean operations on unknown changes;
- use fast-forward-only synchronization where possible;
- record starting SHA, remote SHA, worktree state, and any preserved local modifications;
- do not overwrite unrelated local work.

The Campaign 030 evidence commit expected on remote is:

`0d272dd0e4772f985b33c5d61dccf972723adea9`

If remote has advanced beyond that commit, inspect the intervening commits before continuing. If product behavior changed, establish the new effective product baseline explicitly rather than pretending Campaign 030 still describes exact current behavior.

---

## 4. Phase A — Replace the failed ATD runtime

### 4.1 Do not keep debugging the old black-frame ATD indefinitely

Campaign 030 already established that `swiftshader_indirect`, `software`, and `swiftshader` on the dedicated ATD image still produced a one-color framebuffer with zero rendered frames.

Treat that as sufficient evidence that the previous runtime is unsuitable for visual validation.

Do not spend another long session cycling equivalent flags on the same image.

### 4.2 Create a normal phone AVD

Create a new dedicated phone-oriented AVD using a standard image suitable for actual app rendering.

Selection principles:

- normal phone device profile;
- API compatible with the app's current Android requirements;
- normal Google APIs or standard AOSP image rather than ATD;
- x86_64 where available on this Windows host;
- hardware acceleration if available and stable;
- otherwise supported SwiftShader/software fallback;
- sufficient RAM/storage for the app without excessive host pressure.

Record:

- Android Emulator version;
- AVD name;
- device profile;
- API level;
- image package;
- ABI;
- GPU mode;
- relevant graphics properties;
- serial;
- boot timing;
- host virtualization/backend details if materially relevant.

### 4.3 First hard gate: prove rendered pixels

Before doing a broad route sweep:

1. boot the new AVD;
2. confirm ADB/package manager readiness;
3. install the current baseline APK built from the exact current product source;
4. connect/reverse Metro only as required by the current debug architecture;
5. launch the app;
6. wait for Home to reach a stable populated state;
7. capture a PNG using a normal Android screenshot path;
8. inspect the PNG programmatically and visually.

The screenshot must not merely be a valid PNG. It must contain non-uniform product pixels.

Record at minimum:

- dimensions;
- file size;
- unique color count or equivalent pixel-variance metric;
- mean/min/max luminance or equivalent sanity metric;
- screenshot hash;
- evidence that the visible content corresponds to the expected current Home route.

If screenshots are still uniform/blank on a normal phone image, investigate boundedly across supported renderer modes. Do not loop endlessly. Narrow the cause using SurfaceFlinger/HWUI/logcat/emulator diagnostics and stop once a precise blocker is established.

### 4.4 Pixel validation gate

Do not proceed to visual conclusions until the framebuffer gate passes.

Accessibility/XML hierarchy alone remains structural evidence, not visual evidence.

---

## 5. Phase B — Capture the actual current visual baseline

Once real pixels are proven, capture and index a representative current baseline in both light and dark mode where supported.

At minimum obtain actual rendered evidence for:

- Home / Today
- Games
- Game Detail
- one first-use intro/tutorial
- representative active gameplay
- pause/interruption UI
- per-game Result after a genuine completed/controlled session
- workout between-game continuation
- workout completion
- Progress overview
- one Progress detail surface with data if deterministically achievable
- Profile
- Rewards
- Data Management
- relevant empty/no-history states
- at least one recoverable error state if a safe deterministic fixture already exists

For visual evidence:

- retain screenshots outside Git if repository policy avoids binaries;
- commit an index/manifest with hashes, route/state, theme, device dimensions, timestamp, and reproduction steps;
- never present stale Campaign 028/029 screenshots as current Campaign 030B evidence;
- distinguish actual screenshots from XML/accessibility-tree captures.

### 5.1 Cross-check Campaign 029 hypotheses visually

Now that real pixels exist, explicitly classify the major redesign hypotheses as:

- CONFIRMED
- PARTIALLY CONFIRMED
- CONTRADICTED
- STILL UNVERIFIED

At minimum reassess:

- whether Today is visually dominant enough;
- Home above-the-fold density;
- color/accent competition;
- whether Games reads as recommendation/discovery versus catalog/database;
- Progress visual/comprehension density;
- Profile/Rewards competition;
- game identity before play;
- result hierarchy;
- light/dark equivalence;
- whether the “Neon Arcade” characterization matches actual perception.

Do not force confirmation of Campaign 029. If pixels contradict a hypothesis, record the contradiction and update the master plan/readiness report accordingly.

---

## 6. Phase C — Close dynamic golden-path evidence

Campaign 030's second blocker was the unavailable authorized ARTEMIS provider credential.

This campaign changes the policy: the goal is **trustworthy deterministic runtime evidence**, not ceremonial dependence on one provider path.

### 6.1 Preferred route

If the authorized ARTEMIS/OpenCode Go provider credential is available in the environment without exposing or committing secrets, use the existing intended automation path and run the required live checks.

Never print, commit, or persist provider credentials.

### 6.2 Explicit fallback authorization

If the authorized ARTEMIS provider credential remains unavailable, you are explicitly authorized to validate the required flows using the strongest deterministic alternative already supported by the repository/environment, such as:

- repository-native QA controls;
- Maestro flows already present;
- ADB input combined with stable semantic/test IDs;
- UIAutomator/accessibility-node interaction;
- deterministic dev-only force-win/timeout controls already designed for QA;
- a manual-but-scripted ADB/semantic flow whose exact actions and assertions are recorded.

Do **not** weaken product behavior, alter scoring, add hidden backdoors, or modify production logic to make this easier.

Do not authorize a new external AI provider merely to satisfy the old ARTEMIS path.

If an existing deterministic route can prove the same state transitions, use it and document why it is equivalent for the purpose of runtime readiness.

### 6.3 Required current dynamic journeys

At the exact current baseline, obtain evidence for as much of the following as the product supports:

1. cold launch to Home;
2. start Today's standard workout;
3. enter first game intro/tutorial;
4. start gameplay;
5. pause;
6. resume;
7. complete or deterministically finish the game;
8. reach a populated per-game Result;
9. continue to next game;
10. complete enough legs to prove x/4 progression;
11. finish the standard workout where practical;
12. observe workout completion;
13. leave/relaunch and verify no duplicate session/reward write;
14. interruption/background/relaunch during an in-progress workout;
15. resume at the correct unfinished leg;
16. verify persisted progress after process restart;
17. verify one relevant offline path with network unavailable if the existing harness supports it safely.

Evidence should include:

- route/state assertions;
- semantic IDs or visible labels;
- before/after persisted counts where appropriate;
- screenshot(s) for important states once framebuffer works;
- logs only where they materially prove lifecycle/persistence behavior;
- exact failures and retries.

### 6.4 No fabricated completeness

If one game cannot be completed deterministically without a currently unavailable mechanism, prove the golden-path mechanics through representative games and state exactly what remains unvalidated.

The goal is redesign readiness, not exhaustive regression of all 42 games.

---

## 7. Phase D — Accessibility and real visual structure

Re-run the existing accessibility/semantic audit on the new normal AVD.

Then augment it with actual rendered checks for:

- text clipping;
- overlap;
- off-screen primary actions;
- touch-target visibility;
- system insets;
- keyboard/input overlap where applicable;
- large-font behavior if supported by the harness;
- light/dark contrast sanity;
- landscape only if the app claims support;
- small/large phone behavior if a second disposable profile is cheap enough to validate.

Do not claim WCAG or full accessibility certification from an automated tree audit alone.

---

## 8. Phase E — Expo Doctor classification

Campaign 030 found 14 Expo SDK patch mismatches.

Do **not** update packages automatically in Campaign 030B unless those mismatches demonstrably prevent the new standard runtime from installing, launching, or rendering and a minimal dependency repair is separately justified.

Instead:

- rerun Expo Doctor at current HEAD;
- list exact package/version mismatches;
- classify each group as runtime-blocking, build-risk, compatibility debt, or non-blocking patch drift;
- determine whether the app's successful install/render/runtime evidence on the standard AVD is sufficient to defer the patch update to a dedicated maintenance campaign;
- record a decision: `DEFERRED_SEPARATE_MAINTENANCE`, `MUST_FIX_BEFORE_031`, or equivalent.

Do not mix a broad SDK upgrade into the redesign readiness campaign.

---

## 9. Phase F — GitHub Actions zero-step failures

Campaign 030 found all four workflows failing before any recorded steps.

Investigate only far enough to classify the failure responsibly.

Use available GitHub CLI/API/account-visible data where authorized to inspect:

- run conclusions;
- job metadata;
- runner labels;
- workflow dispatch/event context;
- repository Actions settings where accessible;
- account/billing/quota/service-status indicators where visible;
- whether jobs were ever scheduled onto a runner;
- whether the same workflows fail at unrelated SHAs in the same zero-step pattern.

Do not rewrite workflows simply because they fail externally.

The redesign may proceed with an accepted external CI blocker only if all of the following are true:

- local equivalent static gates pass;
- the failure occurs before repository steps execute;
- no evidence points to a product/test failure;
- the external limitation is documented explicitly;
- the owner accepts it as separate infrastructure debt.

Classify as one of:

- `REPOSITORY_WORKFLOW_DEFECT`
- `RUNNER_OR_ACCOUNT_INFRASTRUCTURE`
- `EXTERNAL_SERVICE_OR_QUOTA`
- `INDETERMINATE_EXTERNAL_PRE_STEP`
- another precise evidence-backed category.

If cause remains inaccessible, say so.

---

## 10. Phase G — Human/manual baseline

Campaign 030 created a human-validation handoff. Do not invent participants or usability findings.

For readiness purposes, obtain whichever of the following is realistically available:

### Preferred

A short current-baseline manual session by a real human on the newly working rendered runtime or an approved physical device, using the existing handoff tasks.

Record only observable task outcomes, hesitation points, and direct comments.

### Acceptable if no participant is available

Mark human usability validation as `PENDING_PHASE_031`, but only after real current screenshots and dynamic golden-path evidence exist.

Human research is important, but lack of an immediately available participant should not by itself trap the repository indefinitely in infrastructure work once the technical baseline is trustworthy.

Campaign 031 must then include human comparison before its phase exit.

Do not use an AI agent's opinion as a substitute for human usability evidence.

---

## 11. Required repository gates

Run the repository's current canonical equivalents for at least:

- typecheck;
- lint;
- CI-mode Jest/full test signal;
- registry/catalog drift;
- provenance/version checks;
- offline/source/security validators;
- dependency audit;
- task ownership / affected-map checks;
- QA self-tests/runtime contract;
- OpenSpec validation;
- web export/build checks where applicable;
- Android build/install validation;
- Expo Doctor.

Do not infer commands from stale docs if package scripts/current automation differ. Use current canonical repository commands.

Record exact pass/fail/skip counts and distinguish allowlisted skips from unexpected skips.

---

## 12. Required documentation outputs

Create or update the following under:

`docs/redesign/evidence/campaign030b/`

At minimum:

### `RUNTIME_ENVIRONMENT.md`

- old ATD blocker summary;
- new AVD/image/profile details;
- emulator/ADB/graphics details;
- exact render-proof measurements;
- any renderer experiments;
- runtime ownership/safety confirmation.

### `VISUAL_BASELINE_INDEX.md`

For every current screenshot/evidence item:

- route/state;
- theme;
- screenshot filename/location outside Git if applicable;
- hash;
- dimensions;
- pixel-variance sanity result;
- reproduction steps;
- classification as screenshot/XML/log/etc.

### `GOLDEN_PATH_RUNTIME.md`

- start → play → pause/resume → result → next → completion;
- interruption/relaunch/resume;
- persistence/idempotency evidence;
- which mechanism drove the flow (ARTEMIS, Maestro, ADB/semantic, etc.);
- exact blocked portions if any.

### `CAMPAIGN029_VISUAL_CROSSCHECK.md`

For each major redesign hypothesis:

- prior hypothesis;
- Campaign 030 structural finding;
- Campaign 030B rendered/runtime evidence;
- final classification;
- whether the implementation master plan needs correction.

### `CI_SDK_DISPOSITION.md`

- Expo Doctor exact status and disposition;
- GitHub Actions current status and best-supported classification;
- what is a redesign blocker versus separate maintenance/infrastructure debt.

### `CAMPAIGN030B_CLOSURE.md`

- start/final SHA;
- repository/environment changes;
- tests/gates;
- evidence summary;
- unresolved items;
- final readiness verdict.

Then update:

`docs/redesign/REDESIGN_READINESS_REPORT.md`

Do not erase Campaign 030 history. Add a clear Campaign 030B closure section or otherwise preserve the chronology so a later reader can see why the verdict changed or remained blocked.

If Campaign 029's master plan materially conflicts with actual rendered evidence, update only the relevant documentation sections and explain why. Do not rewrite history.

---

## 13. Readiness decision rules

### 13.1 `READY_FOR_CAMPAIGN_031`

You may issue this verdict only if all of the following are true:

1. a dedicated non-user-owned Android runtime renders real non-uniform product pixels;
2. current screenshots exist for the core surfaces and both themes where supported;
3. the golden path is dynamically exercised far enough to prove Start/Play/Result/Next and workout progress using trustworthy deterministic controls;
4. interruption/resume/relaunch/persistence is current-baseline validated;
5. no product-source failure is hiding behind the previous ATD issue;
6. local repository gates are healthy or any failure is explicitly isolated and accepted;
7. Expo patch drift has a deliberate disposition and is not silently ignored;
8. GitHub zero-step failures have been classified as far as available evidence permits and are either resolved or explicitly accepted as separate external/infrastructure debt;
9. Campaign 029 visual hypotheses are cross-checked against actual pixels;
10. the repository remains clean and synchronized after documentation/evidence commits;
11. human validation is either completed or explicitly carried into Campaign 031 as a mandatory phase-exit gate.

### 13.2 `BLOCKED_NOT_READY`

Return this if any of the following remain true:

- no runtime can publish real product pixels;
- the app cannot run on a normal supported phone AVD;
- the golden path cannot be exercised at all;
- resume/persistence cannot be validated and no equivalent evidence exists;
- a product/runtime defect is discovered that must be fixed before redesign;
- local static gates materially fail;
- evidence integrity is insufficient to distinguish product failure from infrastructure failure.

Do not return READY merely because semantic XML exists.

---

## 14. Git and write policy

Campaign 030B may commit only:

- campaign evidence documentation;
- readiness-report/master-plan corrections required by new evidence;
- narrowly scoped test-environment/QA documentation if needed.

Do not commit:

- generated AVD files;
- SDK/system-image binaries;
- screenshots unless repository policy explicitly expects them;
- credentials;
- machine-specific absolute configuration;
- product redesign code.

If an absolutely necessary test-only code change is discovered, stop first and classify it. Do not casually mix it into evidence work.

At completion:

- commit the authorized documentation/evidence;
- push to `origin/main` if repository policy and current ownership model permit direct-main work;
- verify local `main` equals remote `main`;
- verify clean worktree;
- report the final SHA.

Never force-push or rewrite history.

---

## 15. Anti-premature-completion rules

Do not stop merely because:

- the new AVD boots;
- one screenshot works;
- Home renders;
- XML is populated;
- one game starts;
- tests are green;
- CI remains externally broken;
- you have enough information to write a plausible report.

Continue until the readiness decision rules have actually been evaluated.

Conversely, do not spend unbounded time on one infrastructure mechanism. Prefer a stronger equivalent route when explicitly authorized by this campaign.

The target is **truthful redesign readiness**, not loyalty to a particular emulator image, GPU mode, or automation provider.

---

## 16. Final response contract

Your final session response must be concise and factual and include:

- final verdict: `READY_FOR_CAMPAIGN_031` or `BLOCKED_NOT_READY`;
- starting product/baseline SHA and final documentation SHA;
- new disposable runtime details;
- whether real product pixels were captured;
- core visual matrix status;
- golden-path/runtime status;
- resume/persistence status;
- accessibility summary;
- Expo Doctor disposition;
- GitHub Actions classification;
- human-validation status;
- exact files created/updated;
- confirmation that no redesign was implemented;
- confirmation of worktree/remote state.

Do not overstate anything that was not observed.
