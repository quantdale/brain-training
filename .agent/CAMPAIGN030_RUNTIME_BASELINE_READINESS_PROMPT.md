# Campaign 030 — Runtime Baseline Recovery & Redesign Readiness

**Status:** READY FOR EXECUTION  
**Mode:** runtime recovery, evidence capture, validation, and documentation-only readiness work  
**Product redesign authorization:** **NONE**  
**Product/source modification authorization:** **NONE unless explicitly stated below**  
**Repository:** `quantdale/brain-training`  
**Campaign 029 product baseline:** `5c484a08083963439360cb06c229249029f90531`  
**Primary output:** `docs/redesign/REDESIGN_READINESS_REPORT.md`

---

## 0. Mission

Campaign 029 produced an implementation-grade redesign plan, but current native runtime observation remained incomplete because the dedicated Android AVD failed to register with ADB. Campaign 030 exists to remove that uncertainty **before any redesign implementation begins**.

Your mission is to establish a trustworthy, current, native runtime baseline for Brain Training; recover or replace the dedicated Android test environment without disturbing user-owned devices; exercise the existing QA/runtime paths at the exact current product baseline; capture representative current UI/runtime evidence; investigate the known GitHub Actions zero-step failures and Expo SDK patch drift far enough to classify them; cross-check Campaign 029's source-derived assumptions against what the app actually renders and does; and issue a precise readiness verdict for the later golden-path redesign campaign.

This campaign is **not** a UI redesign campaign. Do not improve the interface while observing it. Do not refactor code because you notice something ugly. Do not update dependencies merely because Expo Doctor recommends them. Do not modify workflows merely because GitHub Actions is failing. First establish facts.

The campaign succeeds when a later implementation agent can answer, with evidence:

1. What does the current app actually render and how does it behave on a real Android runtime?
2. Which Campaign 029 UX conclusions are confirmed, contradicted, or still uncertain?
3. Are the current workout/game/result/resume/persistence paths healthy enough to serve as the redesign baseline?
4. Are the current CI and SDK issues product blockers, environment/infrastructure blockers, or separate maintenance work?
5. Is the repository ready to begin the golden-path redesign without mixing unrelated failures into it?

---

## 1. Mandatory read order

Before touching the runtime environment, read and understand at minimum:

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. relevant repository/local agent instructions under `.agent/**`, `.agents/**`, `.claude/**`, `.opencode/**`, or equivalent instruction locations that govern this checkout
4. `.agent/CAMPAIGN029_PRODUCT_REDESIGN_DISCOVERY_PROMPT.md`
5. `docs/redesign/PRODUCT_REDESIGN_MASTER_PLAN.md`
6. `docs/redesign/CURRENT_PRODUCT_AUDIT.md`
7. `docs/redesign/RUNTIME_EVIDENCE.md`
8. `docs/redesign/SURFACE_INVENTORY.md`
9. `docs/redesign/PROPOSED_INFORMATION_ARCHITECTURE.md`
10. `docs/redesign/REFERO_REFERENCE_MAP.md`
11. `docs/ANDROID_AUTOMATION.md`
12. current QA/emulator scripts and their self-tests
13. current GitHub workflow definitions
14. current Expo/package configuration and dependency policy

Treat old campaign reports and historical runtime evidence as context, not current proof.

---

## 2. Non-negotiable safety rules

### 2.1 Preserve user work and Git state

- Begin by recording `git status`, current branch, `HEAD`, `origin/main`, configured remotes, and active worktrees.
- Never discard, reset, overwrite, clean, stash, or rewrite pre-existing user work merely to make the campaign easier.
- Do not use `git reset --hard`, destructive checkout/restore, force-push, history rewrite, or broad `git clean`.
- If unexpected local changes exist, preserve them and work around them. Do not pretend the tree was clean.
- Work on `main` only if the repository's current instructions permit it; do not create branches merely for convenience unless required by repository policy.
- Push only campaign-authorized documentation/evidence changes.

### 2.2 Do not touch user-owned devices or host input

The runtime recovery must use a **dedicated automation-owned Android target**.

- Do not commandeer, wipe, reboot, factory-reset, uninstall from, or modify a user-owned phone/emulator.
- Treat `emulator-5554` as user-owned unless current repository instructions explicitly establish otherwise.
- Prefer the existing dedicated `braintraining-qa36` AVD if it can be recovered safely.
- If it is corrupt or unrecoverable, create a **new dedicated AVD with an unmistakably automation-owned name** rather than mutating a user-owned AVD.
- Use a dedicated emulator port when practical.
- Do not use host-global input automation that moves the user's mouse/keyboard or steals focus.
- Avoid global ADB/server resets when they would disrupt unrelated attached devices. If an ADB server restart becomes technically necessary, first enumerate devices, prove no user-owned session would be disrupted, record the reason, and use the narrowest safe action.
- Never delete unrelated AVDs, SDKs, caches, or Android Studio state.

### 2.3 Product code is read-only

This campaign does **not** authorize product implementation.

Do not change:

- `apps/**` product source
- game mechanics, generators, scoring, content, or metadata
- SQLite schema or migrations
- workout logic
- XP/currency/reward/mastery/streak logic
- tests to make failures disappear
- QA semantics merely to force a pass
- dependencies or lockfiles
- Expo config
- CI/workflow files
- build configuration
- generated registries
- production assets
- routes/navigation
- theme/design tokens

If you discover a product defect, document it precisely with reproduction evidence and classify it for a later campaign. Do not fix it here.

### 2.4 Authorized repository writes

Repository writes are limited to Campaign 030 evidence/documentation under:

- `docs/redesign/REDESIGN_READINESS_REPORT.md`
- `docs/redesign/evidence/campaign030/**`

You may also update an existing Campaign 029 runtime-evidence document **only if** doing so improves truth and preserves historical distinction; prefer new Campaign 030 evidence instead of rewriting history.

Curated screenshots are allowed under `docs/redesign/evidence/campaign030/screenshots/` if their size is reasonable and they materially support the audit. Do not dump hundreds of near-duplicate images, videos, SDK caches, APKs, emulator images, logs containing secrets, or large generated artifacts into Git.

If repository policy forbids binary evidence, keep screenshots outside Git and record exact local paths/checksums in the report; do not violate policy.

---

## 3. Evidence discipline

Use explicit evidence labels in the final report:

- **[Observed runtime]** — directly seen on the Campaign 030 native runtime.
- **[Verified by command]** — confirmed by command/test output at the recorded SHA.
- **[Verified in source]** — confirmed by current source/config.
- **[Historical]** — older campaign/commit evidence only.
- **[Inferred]** — a reasoned conclusion from evidence, not directly observed.
- **[Blocked]** — attempted but unavailable, with exact reason and attempts.
- **[External/manual validation pending]** — requires a real human participant or account-level action unavailable to the CLI agent.

Never convert absence of evidence into a pass.

Never write phrases such as “fully validated,” “all good,” “production-ready,” or “fixed” unless the exact required gate was actually executed and passed at the exact SHA.

Do not claim human usability results unless actual human participants were observed. An agent driving an emulator is **not** a human usability study.

---

## 4. Phase A — Establish the exact baseline

Record:

- current `HEAD`
- `origin/main`
- latest Campaign 029 commit
- whether the only delta beyond `5c484a08083963439360cb06c229249029f90531` is Campaign 030's instruction/documentation commit(s)
- dirty/clean state
- Node/npm versions
- Java/JDK version
- Android SDK path and relevant tool versions
- `adb version`
- emulator version
- available system images
- available AVDs
- attached ADB devices
- host OS details relevant to emulator acceleration
- available virtualization/hypervisor state where safely queryable

If product-affecting commits have landed after the Campaign 029 baseline, inspect them before continuing. Do not silently test a materially different product while calling it the Campaign 029 baseline. Record the effective product SHA.

The report must distinguish:

- **instruction/docs HEAD** — current repository commit including Campaign 030 instructions/evidence
- **effective product baseline** — latest commit affecting runtime product behavior

---

## 5. Phase B — Recover a dedicated Android runtime

Campaign 029 attempted `braintraining-qa36`, but it did not register with ADB. Investigate systematically rather than repeatedly relaunching the same failing command.

### 5.1 Diagnose before replacing

Inspect, as applicable:

- AVD definition/config
- selected system image/API/ABI
- emulator executable/version
- acceleration backend availability
- Hyper-V/WHPX/AEHD/HAXM state as relevant to the host
- port conflicts
- stale emulator/QEMU processes
- stale lock files for the **dedicated AVD only**
- disk capacity
- temp/cache failures
- snapshot corruption
- writable data-image status
- boot arguments
- `adb devices -l`
- emulator console connectivity
- boot properties such as `sys.boot_completed`
- `logcat`/emulator stderr for the dedicated target

Do not infer root cause from “device missing.” Obtain the narrowest available diagnostic evidence.

### 5.2 Recovery order

Prefer, in order:

1. safely restart the dedicated AVD with known-good headless/no-snapshot parameters;
2. repair only dedicated-AVD transient state if diagnosis supports it;
3. recreate only the dedicated AVD if its definition/data is corrupt;
4. create a fresh automation-owned AVD using a repository-supported API/system image if recovery is not sensible.

Do not alter the product just to match an emulator.

### 5.3 Runtime acceptance gate

A recovered runtime is not accepted merely because a process exists. Require all of the following where applicable:

- emulator process remains alive for a meaningful interval;
- the target appears in `adb devices` as `device`, not `offline`/`unauthorized`;
- `sys.boot_completed=1` or equivalent boot-complete proof;
- package install succeeds from the repository's supported workflow;
- app launches to a stable foreground state;
- basic ADB shell interaction succeeds;
- screenshots can be captured;
- the app can be relaunched after force-stop;
- the dedicated target can be shut down cleanly without affecting other devices.

Record launch commands and important environment variables, but redact secrets/tokens.

---

## 6. Phase C — Capture the real current UI/runtime baseline

Do not rely on source inspection alone once the runtime works. Observe the rendered app.

Capture enough evidence to characterize at least the following states, using existing QA seeding/deep-linking/deterministic controls where available:

### 6.1 Home / Today

- clean/first-run Home if reproducible without destroying user data outside the dedicated AVD
- returning Home with history
- fresh daily workout
- in-progress/resumable workout
- completed workout state
- workout configuration/focus/length
- reroll/currency decision state if safely reachable with deterministic test data
- Spotlight/recent/mastery/reward sections currently rendered
- scroll depth and above-fold hierarchy on the target viewport

### 6.2 Games

- default Games landing
- recommendation/discovery shelves
- category/filter state
- search state
- favorites state if seedable
- no-results/empty state
- representative Game Detail

### 6.3 Game journey

For a representative set of mechanics, observe at minimum:

- intro/tutorial
- active gameplay
- pause/interruption
- completion/result
- next-game handoff when inside a workout
- final workout completion

Use at least one representative game from multiple interaction families, preferably including several of the Campaign 029 representatives (e.g. visual search, memory, reaction, structured input, logic/rule switching, spatial transformation). Do not waste time visually testing all 42 if the shared shell is proven and catalog automation covers the rest; use the full catalog QA path for breadth and curated runtime observation for depth.

### 6.4 Progress

Observe:

- overview with meaningful seeded/history data
- sparse/no-history state
- at least one domain detail
- at least one game history/detail path
- window selector behavior
- chart/metric readability and scroll depth
- any copy that could be interpreted as a cognitive/medical claim

### 6.5 Profile / Rewards / Data

Observe:

- Profile top and full scroll structure
- streak/motivation sections
- quests/achievements/milestones if present
- Rewards and claim state
- cosmetics/equipment if present
- settings/sensory/theme controls
- Data Management
- export/backup/restore affordances
- destructive delete confirmation without actually destroying anything outside the disposable test profile

### 6.6 Cross-cutting states

Observe where practical:

- light mode
- dark mode
- loading
- empty
- error/retry
- offline behavior
- large text or accessibility scaling
- reduced motion if supported
- rotation/orientation policy
- small/representative phone viewport

Capture screenshots with stable, descriptive filenames. Prefer one image that proves a state over multiple decorative duplicates.

For each captured surface, record:

- how it was reached
- required seed/precondition
- screenshot/evidence filename
- observed primary CTA(s)
- approximate visible decision count above fold
- notable hierarchy/readability issues
- whether it confirms or contradicts Campaign 029

---

## 7. Phase D — Execute current QA/runtime gates at the exact baseline

Read the current automation docs and use the repository-supported commands rather than inventing a parallel harness.

Run the applicable current-head equivalents of:

- Android setup/self-test
- QA harness self-tests
- catalog/listing coverage
- representative canaries
- all-mode or equivalent broad runtime suite
- daily workout path
- workout resume/relaunch path
- persistence/relaunch checks
- result navigation
- representative tutorial/game flows
- accessibility/runtime checks already supported by the harness

Do not mark a target passed because the test was skipped. Preserve exact counts:

- passed
- failed
- skipped/allowlisted
- blocked/not validated

If some of the previous 44 `NOT VALIDATED` targets become executable, report exactly which ones and their new outcomes.

If failures appear, first classify them:

- product defect
- harness defect
- emulator/environment defect
- flaky/transient with evidence
- unsupported/known limitation

Do not patch the product or harness in this campaign. If the **only** blocker is a clearly broken local test-environment script and fixing it would modify repository source, document a proposed minimal fix for a separate maintenance campaign instead of sneaking it into Campaign 030.

---

## 8. Phase E — Re-run source/test health gates

At the effective baseline, run the relevant repository-supported local checks sufficient to establish that Campaign 030 did not regress anything and to correlate runtime findings with Campaign 029. At minimum, where supported:

- typecheck
- lint
- CI-mode Jest/full test suite
- registry drift/consistency validation
- provenance validators
- offline/security/secret validators
- dependency policy/audit
- task ownership/affected-map/workflow hygiene validators
- OpenSpec validation
- web export/build smoke if still part of the current repo gate
- Expo Doctor

Record exact commands and outputs/summaries.

Do not modify dependencies to make Expo Doctor green.

---

## 9. Phase F — Classify Expo Doctor patch drift

Campaign 029 observed 14 SDK-57 patch mismatches. Re-run Expo Doctor and capture the **current exact package list**, installed versions, expected versions, and relevant recommendation.

For each mismatch or logical group, classify:

- patch drift only / likely routine maintenance
- known runtime compatibility risk
- build blocker
- native/runtime blocker
- test-only/tooling concern
- unknown

Use package/Expo documentation or current tooling output when necessary. Do not speculate from version numbers alone.

Answer explicitly:

1. Did any mismatch cause the Campaign 029 AVD/ADB failure? If there is no evidence, say **not established**.
2. Does current native runtime work despite the mismatch?
3. Should dependency alignment happen **before**, **during**, or **after** the golden-path redesign? Give a reasoned sequencing recommendation, but do not perform the update.
4. Would the update likely touch lockfiles/native prebuild outputs and therefore deserve a separate maintenance campaign?

The default separation principle is: **do not mix dependency migration with UX redesign unless there is a demonstrated blocker.**

---

## 10. Phase G — Investigate GitHub Actions zero-step failures

Campaign 029 observed four workflows failing within seconds with zero job steps/logs. Investigate the current runs and recent comparable runs using GitHub/`gh`/API evidence available to the environment.

Inspect, as available:

- workflow run conclusion/status/event
- workflow file and trigger
- run/job metadata
- whether any job object was created
- job/step count
- annotations/check-suite metadata
- repository Actions settings visible to the authenticated account
- runner labels/availability if self-hosted
- concurrency/cancellation behavior
- billing/quota/account restrictions surfaced by GitHub
- permissions/policy failures
- reusable workflow resolution problems
- YAML/workflow parse or dispatch failures
- whether the same workflow succeeded at an earlier commit with materially identical workflow files

Do **not** edit workflow YAML in Campaign 030.

Classify each failed workflow as one of:

- repository workflow/config defect
- runner availability/infrastructure issue
- account/billing/quota/policy issue
- GitHub-side/transient issue
- indeterminate with current permissions/evidence

If the root cause requires account-owner/admin action, state the exact manual action needed if known. Do not fabricate access you do not have.

If CI remains unavailable but local equivalent gates are strong, the final readiness verdict must clearly separate **product readiness for redesign work** from **release/CI readiness**.

---

## 11. Phase H — Cross-check Campaign 029 against rendered reality

Create an explicit confirmation matrix in `REDESIGN_READINESS_REPORT.md`.

For major Campaign 029 findings, mark:

- **CONFIRMED BY RUNTIME**
- **PARTIALLY CONFIRMED**
- **CONTRADICTED / NEEDS PLAN UPDATE**
- **STILL UNOBSERVED**

At minimum cross-check:

1. Home has too many simultaneously primary systems.
2. Today's Workout is not visually dominant enough.
3. Games feels more like a catalog/database than intentional discovery.
4. Progress exposes analytics depth before a concise answer.
5. Profile/Rewards surface too many motivation/economy systems together.
6. The current visual language feels overly expressive/arcade-like for utility surfaces.
7. Game identity is weaker than the underlying mechanics.
8. Results are directionally stronger and more focused than Home/Progress.
9. The four-tab shell is still a sensible structural foundation.
10. Current onboarding/first-run comprehension is unclear or absent.
11. Gamification systems compete with the basic train/play/finish loop.
12. Light/dark themes preserve hierarchy equivalently.
13. The current golden path is technically reliable even if composition is weak.

Do not force Campaign 029 to be right. If runtime evidence disproves a conclusion, update the readiness report and recommend a plan correction.

If a correction materially changes the master plan, create a concise addendum under `docs/redesign/evidence/campaign030/PLAN_CORRECTIONS.md`. Do not rewrite the entire Campaign 029 master plan unless necessary for factual integrity.

---

## 12. Phase I — Human validation boundary

Campaign 029 recommended human usability observation. A CLI agent cannot honestly substitute itself for human participants.

Therefore:

- Do not invent participants, timings, confusion rates, satisfaction scores, or comprehension results.
- If actual people are available through an explicitly provided process, follow the approved process and record anonymized observations only.
- Otherwise create `docs/redesign/evidence/campaign030/HUMAN_VALIDATION_HANDOFF.md` containing a short, executable protocol for the owner to run later.

The protocol should be low-friction and focus on five core tasks:

1. Open the app and identify what to do today.
2. Start/continue and complete one game, including pause/resume.
3. Find a named game and explain its purpose/mechanic.
4. Use Progress to explain consistency and recent recorded performance.
5. Find rewards/settings/data export without coaching.

Provide a simple observation sheet: first tap, time/hesitation, wrong turns, verbal interpretation, confidence, notable confusion. Do not require sophisticated research tooling.

Human validation may remain **external/manual validation pending** without automatically blocking a technically ready golden-path implementation prototype. The readiness report must state this honestly.

---

## 13. Required deliverables

### 13.1 `docs/redesign/REDESIGN_READINESS_REPORT.md`

This is the authoritative Campaign 030 output. It must include:

- executive verdict
- exact effective product baseline SHA
- instruction/docs HEAD
- repository/worktree state
- runtime environment details
- dedicated AVD recovery root cause and what was done
- native boot/install/launch evidence
- QA matrix with exact pass/fail/skip/not-validated counts
- current UI/runtime observations by surface
- screenshot index
- Campaign 029 confirmation/contradiction matrix
- Expo Doctor mismatch classification
- GitHub Actions failure classification
- source/test health summary
- unresolved blockers
- external/manual validation still pending
- recommendation for whether Campaign 031 may begin
- explicit list of things **not** fixed in Campaign 030

### 13.2 `docs/redesign/evidence/campaign030/RUNTIME_MATRIX.md`

Record every runtime scenario attempted with:

- scenario ID
- preconditions/seed
- command or navigation path
- expected behavior
- observed behavior
- evidence artifact
- outcome (`PASS`, `FAIL`, `BLOCKED`, `NOT RUN`)
- notes/root-cause classification

### 13.3 `docs/redesign/evidence/campaign030/SCREENSHOT_INDEX.md`

For each curated screenshot:

- filename
- effective product SHA
- device/API/viewport
- theme
- route/surface
- state/precondition
- reason the screenshot matters

### 13.4 `docs/redesign/evidence/campaign030/ENVIRONMENT_DIAGNOSIS.md`

Document AVD/ADB diagnosis and recovery steps precisely enough that another agent can reproduce the dedicated environment without trial-and-error or touching user-owned devices.

### 13.5 `docs/redesign/evidence/campaign030/CI_AND_SDK_CLASSIFICATION.md`

Keep CI and Expo drift analysis separate from UX findings so a later maintenance campaign can consume it directly.

### 13.6 `docs/redesign/evidence/campaign030/HUMAN_VALIDATION_HANDOFF.md`

Required if real human validation was not performed.

### 13.7 Optional `PLAN_CORRECTIONS.md`

Create only if runtime evidence materially changes Campaign 029 recommendations.

---

## 14. Readiness verdict contract

End the campaign with exactly one primary redesign-readiness classification:

### `READY_FOR_CAMPAIGN_031`

Use only if:

- a dedicated Android runtime is stable;
- current app install/launch works;
- core golden-path runtime flows are exercised sufficiently to establish a baseline;
- major source/test gates are healthy or unrelated failures are clearly classified;
- Campaign 029's core redesign direction remains materially valid after runtime observation;
- no unresolved product/runtime defect makes structural redesign unsafe.

CI may remain externally broken **only if** the report clearly demonstrates that the zero-step problem is separate from product behavior and local equivalent gates are recorded. Human study may remain external/manual pending if not available.

### `READY_WITH_PREREQUISITE_MAINTENANCE`

Use if the product baseline is understood, but one bounded maintenance task should occur before redesign — for example a proven SDK compatibility blocker, a deterministic runtime harness defect, or a repository workflow defect that would make implementation validation unreliable.

Name the prerequisite precisely. Do not implement it here.

### `BLOCKED_NOT_READY`

Use if the native runtime cannot be established, core flows cannot be observed, data safety is uncertain, or failures are too entangled to distinguish redesign risk from environment noise.

Do not downgrade a blocker merely to finish the campaign.

---

## 15. Anti-premature-completion rules

You are **not done** after:

- getting `adb devices` to show one emulator;
- launching Expo once;
- capturing only Home;
- running Jest without native runtime;
- reading Campaign 029 and agreeing with it;
- observing that CI still fails;
- reproducing the Expo Doctor mismatch;
- generating documentation without actually attempting the required runtime paths.

Continue until the required evidence is obtained or a genuine blocker has been diagnosed to the narrowest practical root cause.

Do not spend hours retrying an identical failed emulator command. After a repeated identical failure, switch to diagnosis and an evidence-based alternate recovery path.

Do not hide uncertainty behind verbosity. A concise `BLOCKED` entry with exact proof is better than a speculative success narrative.

---

## 16. Completion and Git contract

Before committing Campaign 030 evidence:

1. confirm no unauthorized product/source/config/dependency/workflow files changed;
2. inspect the complete diff;
3. remove transient logs containing secrets, machine-specific sensitive paths where unnecessary, huge artifacts, emulator data, caches, and generated build outputs;
4. ensure evidence files are readable and self-contained;
5. run the relevant documentation/repository validators;
6. commit only authorized evidence/documentation;
7. push to `origin/main` only if repository policy and current task ownership allow it;
8. verify local `HEAD`, `origin/main`, and remote main alignment;
9. verify the worktree is clean except for deliberately preserved pre-existing user work.

The final CLI response must report:

- starting SHA
- final SHA
- effective product baseline SHA
- readiness classification
- dedicated runtime target used
- native runtime result
- QA pass/fail/blocked counts
- current CI classification
- Expo Doctor classification
- whether Campaign 029 was confirmed or materially corrected
- human validation status
- exact files added/updated
- whether any product code changed (**expected: no**)
- push/alignment/worktree status

---

## 17. Successor boundary

If Campaign 030 ends `READY_FOR_CAMPAIGN_031`, the next campaign should implement only the **golden path structural redesign** described in Campaign 029:

`Home / Today → Start or Continue → Game Intro/Tutorial → Gameplay → Result → Next Game → Workout Completion`

Campaign 031 should not simultaneously redesign the full Games catalog, Progress analytics, Profile/Rewards, and visual system. Those remain later staged work.

Campaign 030 itself must **not** begin that implementation.
