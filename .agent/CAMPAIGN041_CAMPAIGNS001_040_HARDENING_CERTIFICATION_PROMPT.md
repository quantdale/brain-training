# Campaign 041 — Campaigns 001–040 Hardening, Validation & Double-Check Certification

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** exhaustive retrospective audit + current-state hardening + native validation + bounded defect repair  
**Starting point:** Campaigns 033–039 complete; Campaign 040 conditional; current terminal handoff on `main`  
**Primary objective:** independently re-establish trust in the product after Campaigns 001–040 rather than trusting campaign documentation at face value  
**Primary evidence root:** `docs/redesign/evidence/campaign041/`  
**Successor:** release-certification closure only after this campaign has independently revalidated the current product

---

## 0. Operator intent

The operator explicitly does **not** want to take the previous campaign reports on faith.

Treat every historical statement from Campaigns 001–040 as an assertion to be checked, not as truth.

This campaign exists to answer:

> “After forty campaigns of implementation, redesign, validation, recovery, and hardening, what is actually true in the current repository and current app — and what can we independently prove right now?”

You are authorized to spend substantial time reconstructing history, inspecting source, running tests, exercising the native app, inspecting persisted state, using ARTEMIS and other available tooling, and repairing **demonstrated current defects** when that repair is bounded and can be independently validated.

Do not optimize for speed or for a green label. Optimize for discovering hidden regressions, contradictions, stale assumptions, missed edge cases, and false confidence.

A truthful CONDITIONAL or BLOCKED result is preferable to a superficial PASS.

---

## 1. Core evidence doctrine — mandatory

### 1.1 Historical documents are leads, not authority

Do not blindly trust:

- campaign closure reports;
- README files;
- `.agent` state files;
- OpenSpec status claims;
- prior screenshots;
- prior test summaries;
- prior “PASS” labels;
- comments;
- snapshots;
- handoff documents;
- old generated evidence;
- commit messages.

They may be stale, incomplete, contradictory, written against another SHA, or simply wrong.

### 1.2 Current truth hierarchy

For material claims, prefer evidence in this order:

1. reproducible observation on the **current** dedicated native runtime;
2. current persisted-state inspection after a real flow;
3. current executable tests/validators;
4. current source/configuration inspection;
5. current build/package output;
6. current Git history and diffs;
7. historical campaign evidence.

When two sources conflict, investigate. Do not average them together and do not silently choose the more convenient result.

### 1.3 Evidence labels

Use these labels consistently:

- `[OBSERVED_RUNTIME]`
- `[VERIFIED_PERSISTED_STATE]`
- `[VERIFIED_TEST]`
- `[VERIFIED_SOURCE]`
- `[VERIFIED_BUILD]`
- `[VERIFIED_GIT]`
- `[HISTORICAL_ONLY]`
- `[INFERRED]`
- `[CONTRADICTED]`
- `[BLOCKED]`
- `[MANUAL/EXTERNAL_PENDING]`

Never promote `[HISTORICAL_ONLY]` into a current PASS without new evidence.

---

## 2. Safety and Git contract

Before doing anything:

- fetch/synchronize safely;
- record `HEAD`, `origin/main`, branch, status, remotes, worktrees, stashes, and recent commits;
- preserve all pre-existing/concurrent user work;
- never use destructive recovery merely to simplify the audit;
- no `reset --hard` over unknown work;
- no force checkout over unknown work;
- no force push;
- no deleting unrelated worktrees/AVDs/caches;
- no rewriting published history.

If remote `main` changes while you work, inspect ancestry and reconcile safely.

### 2.1 Runtime safety

Use only a clearly dedicated automation-owned runtime.

Do not commandeer, wipe, stop, reinstall to, or send input to a user-owned physical device or emulator.

Prefer the existing known automation-owned Android 15 / API 35 test AVD only if current inspection confirms it is safe. Otherwise create a new unmistakably named disposable AVD.

### 2.2 Data safety

All destructive persistence/migration/backup testing must use disposable app data, copied databases, temporary fixtures, or a dedicated emulator.

Never risk user data merely to prove a migration or restore path.

---

## 3. Scope

Campaign 041 audits the **current consequences and surviving contracts** of Campaigns 001–040.

It does not require reproducing forty historical environments exactly. Instead, it must reconstruct what each campaign claimed to establish, determine whether that claim is still relevant, and independently verify the resulting current behavior/invariant whenever technically possible.

The audit is both:

- **historical:** What did Campaigns 001–040 claim/change?
- **current:** Does the current product still satisfy the intended contracts?

---

## 4. Phase A — Historical reconstruction: Campaigns 001–040

Build a campaign ledger with **one row for every number 001 through 040**.

Search broadly:

- `git log --all --date-order`;
- commit messages;
- changed-file history;
- `.agent/**`;
- `.agents/**`;
- `.claude/**`;
- `.opencode/**`;
- `docs/**`;
- `openspec/**`;
- evidence directories;
- campaign state files;
- QA artifacts tracked in Git;
- tests introduced by historical campaigns;
- generated registries and validators;
- merge commits / PR references when locally or remotely accessible.

Do not invent a campaign description merely because a number exists.

For each campaign record:

- campaign number;
- discoverable name/purpose;
- best-known implementation SHA(s);
- claimed product changes;
- claimed invariants;
- claimed validation;
- files/tests apparently introduced;
- whether later campaigns superseded it;
- current relevance;
- confidence in reconstruction;
- current verification status.

Use exactly one of these current statuses:

- `CURRENTLY_VERIFIED`
- `SUPERSEDED_BUT_CURRENTLY_SAFE`
- `PARTIALLY_VERIFIED`
- `CONTRADICTED_BY_CURRENT_EVIDENCE`
- `NOT_RECONSTRUCTABLE`
- `NOT_APPLICABLE_TO_CURRENT_PRODUCT`

A missing old report is not itself a defect. A current contradiction is.

Required output:

`docs/redesign/evidence/campaign041/HISTORICAL_CAMPAIGN_LEDGER_001_040.md`

---

## 5. Phase B — Current product contract inventory

Independently reconstruct the product's current critical contracts from source and runtime.

At minimum cover:

### Application shell
- routing;
- four-tab ownership;
- invalid-route recovery;
- deep-link behavior;
- navigation stack cleanup;
- loading boundaries;
- error boundaries.

### Golden path
- Home/Today;
- deterministic daily workout;
- start/continue;
- persisted workout identity;
- intro/tutorial;
- gameplay;
- pause/resume/background;
- per-game results;
- next-game transition;
- final completion;
- completed-day Home.

### Games
- all registry/catalog entries;
- discovery;
- search;
- filtering;
- Favorites;
- Suggested Next;
- Game Detail;
- lazy loading;
- game identity metadata;
- mastery links;
- standalone launch.

### Progress
- overview;
- time windows;
- sparse/no-data behavior;
- domain drill-down;
- per-game history;
- chart semantics;
- history ownership;
- cautious/non-medical wording.

### Profile / Rewards / Data
- profile identity;
- motivation/streak;
- rewards;
- claim idempotency;
- cosmetics;
- settings;
- data management;
- export/import/backup seams;
- local/offline trust copy.

### Cross-cutting
- light/dark;
- large text;
- small viewport;
- orientation assumptions;
- offline;
- relaunch;
- accessibility;
- semantic IDs;
- 44dp touch targets;
- persistence;
- migrations;
- determinism;
- provenance;
- secrets boundary;
- build/release boundary.

Required output:

`docs/redesign/evidence/campaign041/CURRENT_CONTRACT_MATRIX.md`

---

## 6. Phase C — Full repository validation, including previously skipped probes

Run the current repository's authoritative checks.

At minimum:

- complete Jest suite in CI mode;
- typecheck;
- lint;
- all repository validators;
- generated registry/catalog validation;
- provenance validation;
- offline-boundary validation;
- secrets validation;
- task-ownership validation;
- affected-map validation;
- dependency audit;
- workflow hygiene;
- runtime-QA contract;
- OpenSpec validation;
- Expo Doctor;
- web export;
- Android debug build;
- Android release build if supported by current local signing assumptions.

### 6.1 Explicitly investigate skipped/opt-in tests

Previous runs reported explicit opt-in skips around performance and large-backup probes.

Do not merely repeat “5 known skips.”

Discover why every skipped suite/test is skipped.

Where safe and technically supported, execute the underlying opt-in probes directly using the documented environment/flags.

For each skip classify:

- intentionally expensive but PASS when explicitly run;
- unsupported in this environment;
- obsolete;
- flaky;
- currently failing;
- requires manual/external resource.

Do not weaken tests to make them pass.

### 6.2 Test quality audit

Inspect whether high-value current contracts are genuinely asserted.

Pay particular attention to:

- exactly-once reward/XP/currency writes;
- duplicate rating/session prevention;
- workout identity/provenance;
- pause/background/relaunch;
- tutorial persistence and overlay lifecycle;
- migrations;
- backup/restore;
- Favorites;
- settings write serialization;
- invalid routes;
- sparse analytics;
- all-game registry integrity.

Add focused regression tests only when you identify a current coverage gap with realistic defect value.

Required output:

`docs/redesign/evidence/campaign041/REPOSITORY_VALIDATION_MATRIX.md`

---

## 7. Phase D — Persistence, migration, idempotency, backup and restore audit

This is a high-risk lane. Be exhaustive.

### 7.1 Fresh-state validation

On disposable data:

- fresh install;
- database initialization;
- default profile/settings;
- first workout;
- first game;
- first reward/rating/session;
- relaunch;
- offline relaunch.

### 7.2 Current persisted-state invariants

After real flows inspect SQLite directly and verify:

- schema/user version;
- integrity check;
- expected tables/indexes;
- foreign-key behavior if enabled;
- unique keys relied upon by exactly-once logic;
- no duplicate currency operation IDs;
- no duplicate rating keys;
- no duplicate session identity;
- workout instance identity/provenance;
- completion index/status;
- session metadata/versioning;
- settings persistence;
- Favorites persistence;
- tutorial persistence;
- profile/reward state.

### 7.3 Migration coverage

Discover all schema migrations actually present.

Do not assume migration tests are enough.

Where feasible:

- create/copy representative older-schema databases using repository-supported fixtures or migration helpers;
- upgrade them in a disposable environment;
- verify resulting schema and representative data;
- run `PRAGMA integrity_check`;
- verify no silent data loss on key tables.

If historical fixture coverage is incomplete, document exact version gaps.

### 7.4 Backup/export/import

Exercise supported backup/export/restore/import paths using disposable data.

Verify:

- exported artifact exists and is structurally valid;
- restore/import round-trip preserves representative data;
- duplicate or replay behavior does not double-award irreversible state;
- invalid/corrupt inputs fail safely;
- cancellation/system-sheet boundaries do not corrupt state where automation can cover them.

Never claim system document/share-sheet UX is human-validated if it was not.

Required output:

`docs/redesign/evidence/campaign041/PERSISTENCE_MIGRATION_BACKUP_AUDIT.md`

---

## 8. Phase E — Full daily-workout and session correctness audit

Campaign 040 did not complete the full four-game workout during its final pass. Close that gap.

On a clean dedicated runtime:

1. generate/start today's workout;
2. record workout ID, selected game IDs, seed/provenance metadata;
3. complete **all four games** through the real workout path;
4. inspect each result;
5. use Next Game transitions;
6. finish workout;
7. return to Home;
8. force-stop;
9. relaunch;
10. verify completed state persists;
11. inspect SQLite;
12. verify exactly-once reward/rating/XP/currency/session/workout writes.

Then test interruption:

- start another disposable workout/state if the product supports an isolated fixture/date;
- pause;
- background;
- force-stop/relaunch;
- resume;
- complete;
- ensure no duplicate writes or lost identity.

Do not alter real date/device state globally to manufacture a second daily workout unless repository QA tooling provides a safe isolated mechanism.

Required output:

`docs/redesign/evidence/campaign041/WORKOUT_SESSION_INVARIANTS.md`

---

## 9. Phase F — All-42 game lifecycle sweep

Do not claim catalog safety from registry enumeration alone.

The objective is not to manually achieve expert gameplay in 42 games. The objective is to prove every registered game can traverse its supported lifecycle on the current build.

For **all 42 current registered games**, verify as far as deterministic QA hooks allow:

- registry resolution;
- lazy load/import;
- Game Detail;
- intro;
- tutorial/example availability where declared;
- game start;
- first interactive state;
- pause/background contract if shared;
- completion/result using legitimate development-only deterministic QA controls where necessary;
- result persistence;
- no fatal/RedBox/invariant error;
- return/navigation;
- expected domain/category/identity metadata.

Do not silently use a force-win hook and call that “mechanic correctness.” Distinguish:

- lifecycle validation;
- mechanic-specific automated test coverage;
- actual interactive/manual mechanic coverage.

For each of the eight mechanic/domain families, perform deeper real interaction without skipping straight to completion.

If a game cannot be launched or completed under existing deterministic QA support, document it rather than adding a bypass solely for this audit unless the lack of a QA seam is itself worth fixing.

Required output:

`docs/redesign/evidence/campaign041/GAME_CATALOG_42_LIFECYCLE_MATRIX.md`

---

## 10. Phase G — Native visual, navigation and accessibility sweep

Use real native rendered pixels.

Cover both light and dark themes where meaningful.

At minimum inspect:

- Home fresh;
- Home active workout;
- Home completed workout;
- Games default;
- search;
- category filter;
- Favorites;
- no results;
- Game Detail populated;
- intro/tutorial;
- active gameplay;
- pause;
- per-game result;
- workout final result;
- Progress empty;
- Progress populated;
- domain/game drill-down;
- Profile;
- Rewards empty/populated;
- Data Management;
- settings;
- invalid route recovery;
- loading/error boundaries;
- representative large-text states;
- representative compact viewport states.

Run automated accessibility checks against the actual current hierarchy.

Audit:

- labels;
- roles;
- focusability;
- duplicate ambiguous labels;
- hidden actionable controls;
- clipped actionable controls;
- minimum touch targets;
- text truncation;
- contrast where tooling can measure reliably;
- modal/overlay focus trapping;
- bottom-nav occlusion;
- scroll reachability.

If TalkBack can be enabled and exercised deterministically without pretending a human experience, perform a bounded technical traversal and label it appropriately. Human screen-reader quality remains manual unless a human actually evaluates it.

Required outputs:

- `docs/redesign/evidence/campaign041/NATIVE_RUNTIME_MATRIX.md`
- `docs/redesign/evidence/campaign041/ACCESSIBILITY_TOUCH_TARGET_AUDIT.md`

---

## 11. Phase H — Reliability, concurrency and lifecycle stress

Re-check historical areas vulnerable to race conditions or double writes.

At minimum stress:

- rapid repeated taps on primary actions;
- Start/Continue double activation;
- reward claim repeated activation;
- Favorite rapid toggle;
- settings rapid toggle/write;
- pause/resume loops;
- background/foreground;
- force-stop/relaunch;
- route push/pop repetition;
- tutorial open/close around state transition;
- result Next/Finish repeated activation;
- concurrent-looking SQLite write paths exposed by UI;
- app relaunch while Metro/dev tooling is absent for release build;
- offline startup and transitions.

Use bounded loops, not destructive infinite stress.

Inspect logs and database state after stress.

Required output:

`docs/redesign/evidence/campaign041/RELIABILITY_CONCURRENCY_STRESS.md`

---

## 12. Phase I — Performance and resource sanity

Do not speculate. Measure.

Use current tooling to inspect representative:

- cold start;
- warm start;
- Home render;
- Games first load/lazy load;
- Progress populated render;
- Game Detail;
- game start;
- result transition;
- workout transition.

Record rough repeatable timing/resource evidence where available.

Look for:

- severe JS/main-thread stalls;
- runaway rerenders;
- obvious memory growth across repeated game navigation;
- persistent timers/subscriptions after leaving gameplay;
- log spam;
- repeated database work;
- pathological lazy-load behavior.

Only optimize if a real current issue is measured and the repair is bounded.

Required output:

`docs/redesign/evidence/campaign041/PERFORMANCE_RESOURCE_SANITY.md`

---

## 13. Phase J — Security, privacy, dependencies and release-build sanity

Re-check:

- secrets committed/tracked;
- debug-only QA controls bounded from production/release;
- network/offline policy;
- external URLs;
- unsafe logging of sensitive local data;
- dependency advisories;
- Expo package alignment;
- Android manifest/exported components;
- backup/debuggable assumptions where relevant;
- release build behavior independent from Metro;
- generated artifacts not accidentally committed;
- package/version metadata.

Do not make broad dependency upgrades unless a demonstrated blocker requires it.

Required output:

`docs/redesign/evidence/campaign041/SECURITY_DEPENDENCY_RELEASE_AUDIT.md`

---

## 14. Phase K — External CI investigation without symptom-masking

The most recent campaign reported four GitHub workflow runs failing before any job steps.

Re-query current runs at the Campaign 041 commits.

Inspect, where permissions expose them:

- workflow run metadata;
- jobs;
- job steps;
- annotations;
- event;
- workflow SHA;
- runner labels;
- concurrency;
- branch/rules interaction;
- billing/quota/account/policy clues;
- status history of prior known-good runs.

Do not edit workflow YAML simply to make the red indicator disappear.

Classify exact status as one of:

- `REPOSITORY_WORKFLOW_DEFECT`
- `RUNNER_INFRASTRUCTURE`
- `ACCOUNT_OR_POLICY`
- `GITHUB_TRANSIENT`
- `INDETERMINATE_EXTERNAL_PRE_STEP`
- `PASS`

If repository workflow syntax/config is genuinely proven defective, a bounded repair is authorized with independent validation.

Required output:

`docs/redesign/evidence/campaign041/EXTERNAL_CI_CLASSIFICATION.md`

---

## 15. Defect-repair policy

Campaign 041 is not read-only. It may repair **observed current defects**.

However, every repair must follow this sequence:

1. reproduce;
2. minimize;
3. identify root cause;
4. classify severity;
5. add/strengthen regression coverage where realistic;
6. make the smallest coherent fix;
7. rerun focused validation;
8. rerun affected broader gates;
9. native-retest if user-visible/runtime-affecting;
10. record before/after evidence.

### 15.1 Repairs requiring extreme caution

Do not casually modify these simply because a test is inconvenient:

- schema/migrations;
- backup format;
- scoring formulas;
- generators;
- economy rules;
- XP/reward values;
- workout selection semantics;
- session identity;
- rating formulas;
- registry IDs;
- route IDs consumed by automation;
- security boundaries.

If a real defect requires changing one, isolate it, prove it, and run the strongest relevant regression matrix.

### 15.2 Forbidden “fixes”

Do not:

- weaken assertions;
- delete failing tests without replacement;
- mark failures allowlisted merely to close the campaign;
- suppress logs instead of fixing the cause;
- hide CI failures;
- disable accessibility checks;
- bypass persistence to make a flow pass;
- replace real runtime evidence with snapshots;
- claim unsupported human/platform validation.

Required output:

`docs/redesign/evidence/campaign041/DEFECT_REPAIR_LOG.md`

---

## 16. Adversarial double-check pass

After you think the campaign is done, assume the first audit missed something.

Perform a second independent pass focused on contradictions.

Ask at minimum:

- What previous PASS claims rely only on stale evidence?
- Which tests can pass while the real app still fails?
- Which native states were never actually reached?
- Which tables can duplicate writes despite happy-path tests?
- Which migrations lack representative fixture coverage?
- Which game IDs are only registry-valid but not runtime-valid?
- Which controls pass semantic checks but are visually occluded?
- Which “offline” flows accidentally depend on Metro/dev infrastructure?
- Which release flows are only debug-valid?
- Which exact-once guarantees fail under double tap or relaunch?
- Which empty states mask inconsistent stored data?
- Which docs contradict current code?
- Which errors are classified as tooling failures without enough proof?
- Which campaign closure labels are stronger than their evidence?

Run targeted tests/observations for the highest-risk answers.

Document the adversarial pass separately:

`docs/redesign/evidence/campaign041/ADVERSARIAL_SECOND_PASS.md`

---

## 17. Human/platform boundary

Do not fabricate:

- human usability;
- human TalkBack/VoiceOver quality;
- physical-device thermals;
- physical iOS behavior;
- store-install behavior;
- production signing behavior;
- system share/document picker usability.

Where unavailable, provide a precise manual handoff.

Required output:

`docs/redesign/evidence/campaign041/HUMAN_PLATFORM_VALIDATION_HANDOFF.md`

---

## 18. Required closure packet

Create:

1. `docs/redesign/evidence/campaign041/CAMPAIGN041_CLOSURE.md`
2. `docs/redesign/evidence/campaign041/HISTORICAL_CAMPAIGN_LEDGER_001_040.md`
3. `docs/redesign/evidence/campaign041/CURRENT_CONTRACT_MATRIX.md`
4. `docs/redesign/evidence/campaign041/REPOSITORY_VALIDATION_MATRIX.md`
5. `docs/redesign/evidence/campaign041/PERSISTENCE_MIGRATION_BACKUP_AUDIT.md`
6. `docs/redesign/evidence/campaign041/WORKOUT_SESSION_INVARIANTS.md`
7. `docs/redesign/evidence/campaign041/GAME_CATALOG_42_LIFECYCLE_MATRIX.md`
8. `docs/redesign/evidence/campaign041/NATIVE_RUNTIME_MATRIX.md`
9. `docs/redesign/evidence/campaign041/ACCESSIBILITY_TOUCH_TARGET_AUDIT.md`
10. `docs/redesign/evidence/campaign041/RELIABILITY_CONCURRENCY_STRESS.md`
11. `docs/redesign/evidence/campaign041/PERFORMANCE_RESOURCE_SANITY.md`
12. `docs/redesign/evidence/campaign041/SECURITY_DEPENDENCY_RELEASE_AUDIT.md`
13. `docs/redesign/evidence/campaign041/EXTERNAL_CI_CLASSIFICATION.md`
14. `docs/redesign/evidence/campaign041/DEFECT_REPAIR_LOG.md`
15. `docs/redesign/evidence/campaign041/ADVERSARIAL_SECOND_PASS.md`
16. `docs/redesign/evidence/campaign041/HUMAN_PLATFORM_VALIDATION_HANDOFF.md`

Do not create empty ceremonial files. If two small topics are better combined, that is acceptable only if the closure file clearly maps every required topic to its evidence location.

---

## 19. Final verdict

Return exactly one primary verdict:

### `CAMPAIGN_041_HARDENING_CERTIFIED`

Use only if:

- no unresolved Critical/High current product correctness defect remains;
- full repository gates pass or deviations are explicitly external/non-product;
- full four-game workout current replay passes;
- persistence/idempotency checks pass;
- migration/backup coverage is acceptably exercised or bounded gaps are demonstrably non-blocking;
- all 42 games have current lifecycle evidence;
- eight families have deeper current runtime evidence;
- required native surface/a11y coverage passes;
- adversarial second pass finds no release-blocking contradiction;
- any repairs are fully revalidated.

This verdict does **not** imply human/iOS/store certification if those were not actually done.

### `CAMPAIGN_041_CONDITIONAL`

Use when current product correctness is strong but material manual/external/platform evidence remains unavailable, or bounded Medium/Low debt remains that should be explicit before release closure.

### `CAMPAIGN_041_BLOCKED`

Use when:

- a Critical/High correctness/data-loss/idempotency/migration/session/workout defect remains unresolved;
- core runtime cannot be exercised;
- evidence is too contradictory to certify current behavior;
- repairs introduced unresolved regressions;
- current app cannot complete the required core flows.

Do not invent a more flattering label.

---

## 20. Git completion contract

Before final handoff:

- review the entire diff;
- remove temporary artifacts/secrets;
- do not commit APKs, emulator images, raw massive traces, credentials, or transient caches;
- ensure every source repair has corresponding evidence/tests as appropriate;
- commit coherent checkpoints rather than one unreviewable dump when practical;
- push to `main` under existing repository policy;
- verify `HEAD == origin/main`;
- verify clean worktree except explicitly preserved pre-existing user work;
- record exact starting/final/product-validation SHAs.

The final CLI response must report:

- starting SHA;
- final SHA;
- validated product SHA;
- primary verdict;
- Campaign 001–040 ledger summary counts by status;
- defects found;
- defects fixed;
- defects still open by severity;
- full-workout result;
- 42-game lifecycle result;
- persistence/migration/backup result;
- repository test counts;
- native/a11y counts;
- performance/stress findings;
- external CI classification;
- ARTEMIS/tooling actually used;
- human/platform pending items;
- whether any product source changed;
- `HEAD == origin/main` state;
- worktree state;
- exact safest next action.

---

## 21. Anti-premature-completion rules

Campaign 041 is **not complete** merely because:

- Jest passes;
- the app launches;
- Home looks correct;
- 22 static screenshots pass;
- the registry contains 42 games;
- Campaign 040 already had a release build;
- old reports say migrations passed;
- old reports say a workout passed;
- Expo Doctor is green;
- accessibility automation says 0 violations;
- one representative game per family works;
- documentation was generated.

You must independently close the high-risk current-product questions above.

---

## 22. Tooling authorization

Use the tools that materially improve evidence quality, including where available:

- ARTEMIS;
- computer use;
- Android emulator;
- ADB;
- UIAutomator;
- Maestro;
- repository QA harnesses;
- SQLite tooling;
- Gradle/Expo/Node tooling;
- Git/GitHub;
- browser/research for current platform documentation;
- parallel read-only subagents for historical/source/test auditing.

ARTEMIS is a useful observer/operator, not an authority. Cross-check important ARTEMIS conclusions with runtime trees, screenshots, persisted state, logs, tests, or source.

Parallel agents may audit independent lanes, but coordinate ownership and serialize overlapping writes. The main orchestrator remains responsible for the final truth model.

---

## 23. Core directive

**Do not trust the success story. Re-prove it.**

Audit Campaigns 001–040 from the current product backward.

Find stale assumptions.

Find contradictions.

Exercise the real app.

Inspect the real database.

Run the skipped probes.

Complete the full workout.

Lifecycle-check all 42 games.

Stress exactly-once behavior.

Re-test migration and backup seams.

Inspect release behavior.

Challenge every convenient PASS.

Repair demonstrated defects carefully.

Then perform a second adversarial pass against your own conclusions.

Only after that issue the Campaign 041 verdict.
