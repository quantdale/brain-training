# Overnight Autonomous Execution — Campaigns 043–050

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** long-running autonomous release hardening + validation + bounded repair + durable handoff  
**Starting point:** Campaign 042 is technically certified; begin with Campaign 043  
**Target horizon:** continue sequentially as far as safely possible through Campaign 050  
**Completion expectation:** substantial validated progress; later campaigns may be PARTIAL / CONDITIONAL

---

## 0. Operator intent

The human operator is going offline and explicitly wants useful development/validation to continue through the night rather than stopping after one campaign.

You are authorized to work autonomously for the duration of the available session.

Use the strongest available development and validation tools when they materially improve confidence or velocity, including:

- ARTEMIS;
- computer use;
- Android emulator;
- ADB;
- UIAutomator;
- Maestro;
- SQLite tooling;
- repository QA scripts;
- Gradle/Expo/Node tooling;
- Git/GitHub;
- browser/research tools;
- read-only parallel/sub-agent investigations;
- other safe tools available in the environment.

Do **not** wait for the operator between Campaigns 043, 044, 045, 046, 047, 048, 049, and 050.

Preferred behavior:

`043 → validate/checkpoint → 044 → validate/checkpoint → 045 → ... → 050`

However, campaign-number velocity is not the goal.

A truthful `OVERNIGHT_COMPLETE_THROUGH_047_CAMPAIGN_048_PARTIAL` is better than eight shallow “complete” labels.

---

## 1. Coupled authoritative files

Read these together:

1. `.agent/CAMPAIGN043_INDEPENDENT_PLATFORM_RELEASE_VALIDATION_PROMPT.md`
2. `docs/redesign/CAMPAIGN043_050_OVERNIGHT_ROADMAP.md`
3. this file
4. repository governing instructions
5. current Campaign 042 closure/evidence

Campaign 043 has its own detailed contract.

Campaigns 044–050 use the roadmap plus this orchestrator as their fragmentation contract.

If old documentation conflicts with current runtime/source evidence, investigate rather than blindly honoring the old document.

---

## 2. CRITICAL: do not blindly trust documentation

This is mandatory.

Campaign 042 is strong evidence, not infallible truth.

Older campaign closures, README files, `.agent` state, OpenSpec status, comments, snapshots, screenshots, generated reports, and commit messages may be stale or inconsistent.

For every material conclusion use this confidence hierarchy:

1. **Current reproducible runtime observation**
2. **Current persisted-state/database evidence**
3. **Current executable tests/validators**
4. **Current source/configuration**
5. **Current build/package output**
6. **Current external CI/API evidence**
7. **Git history**
8. **Historical documentation**

Before claiming:

- visual success → inspect real current pixels;
- persistence correctness → inspect current DB or deterministic tests;
- accessibility success → run current hierarchy/a11y checks;
- release independence → launch current release build without Metro;
- CI diagnosis → inspect current run/job/step evidence;
- bug fix → reproduce or build a regression probe;
- performance improvement → measure before/after;
- human/platform success → actually execute that human/platform validation.

Never fabricate missing evidence just to keep the overnight sequence moving.

---

## 3. Startup procedure

At session start:

1. locate repository root;
2. read governing instructions;
3. fetch remote `main`;
4. inspect branch, HEAD, `origin/main`, worktree, worktrees, stashes, local-only commits;
5. preserve all pre-existing and concurrent work;
6. synchronize safely, preferring fast-forward;
7. record exact starting SHA;
8. inspect the current product/source/runtime rather than relying only on Campaign 042 docs;
9. inventory available tools and runtimes;
10. begin Campaign 043.

If remote `main` changes during the night:

- fetch;
- inspect incoming commits;
- determine overlap;
- reconcile safely;
- do not overwrite concurrent work.

Never force-push or reset away unknown changes.

---

## 4. Tooling authorization and boundaries

### 4.1 ARTEMIS

ARTEMIS is explicitly authorized and encouraged for exploratory runtime work, journeys, diagnostics, and adversarial observation.

ARTEMIS is not an authority.

Cross-check important conclusions with source, screenshots, UI hierarchies, logs, persisted state, or executable tests.

If ARTEMIS transport/provider/tasks time out, diagnose boundedly then use deterministic fallbacks. Do not waste the night retrying indefinitely.

### 4.2 Computer use

Computer-use interaction is authorized for development/testing when no cleaner CLI path exists.

Do not interact with unrelated personal accounts/data.

### 4.3 Android runtimes

Use only clearly automation-owned/dedicated Android runtimes.

Do not wipe, stop, install to, or send input to a user-owned emulator or physical device.

A physical Android device may be used only if it is clearly identified as automation-authorized.

### 4.4 iOS

Use a genuine iOS environment only if it actually exists and is authorized.

Do not infer iOS runtime success from source code or web behavior.

### 4.5 Credentials/signing

Never commit:

- credentials;
- API keys;
- tokens;
- keystores;
- signing passwords;
- private certificates;
- browser profiles;
- private traces.

Inspect configuration without leaking secrets.

---

## 5. Overnight progression logic

### Campaign 043

Execute:

`.agent/CAMPAIGN043_INDEPENDENT_PLATFORM_RELEASE_VALIDATION_PROMPT.md`

If outcome is:

- `CAMPAIGN_043_COMPLETE` → continue immediately to 044.
- `CAMPAIGN_043_PARTIAL_MANUAL_PLATFORM_PENDING` → if pending items are genuinely human/iOS/physical/store-only and no product blocker exists, checkpoint and continue to 044.
- `CAMPAIGN_043_BLOCKED` → if blocked by a severe current product defect, repair or stop progression. If blocked only by an external/manual dependency, document and continue independent later work where safe.

### Campaigns 044–050

Use:

`docs/redesign/CAMPAIGN043_050_OVERNIGHT_ROADMAP.md`

At the start of each packet:

- re-check Git state;
- re-observe the relevant current system;
- create evidence directory;
- establish current baseline;
- identify protected contracts;
- decide whether implementation is actually justified.

At closure:

- run focused tests;
- run risk-appropriate broad tests;
- perform native/runtime validation where relevant;
- inspect logs/persisted state when relevant;
- write evidence;
- commit/push;
- decide whether next campaign is independent/safe.

---

## 6. Campaign-specific guardrails

### Campaign 044 — External CI / workflow diagnosis

Do not assume the zero-step failures are repository defects.

Inspect current runs deeply.

Only modify workflow YAML/configuration if a repository-side defect is proven.

Do not “fix” CI by disabling jobs, reducing required checks, swallowing failures, or moving commands out of CI.

If external/account/policy/runner related, document exactly what evidence is available and continue.

### Campaign 045 — Expo/dependency maintenance

First verify that the five-package patch drift still exists.

Use supported Expo tooling.

Keep package/lockfile changes isolated.

Do not perform broad dependency modernization.

After changes, run the strongest applicable build/runtime matrix.

If a maintenance update destabilizes the product, back out only campaign-owned changes safely and record the result.

### Campaign 046 — 42-game repeatability/soak

Do not reduce this to registry enumeration.

All 42 need current lifecycle evidence.

Use deterministic QA support honestly.

For a risk-weighted subset across all eight domains, execute repeated real interactions.

Distinguish:

- lifecycle validity;
- mechanic-specific test coverage;
- real manual/automated interaction;
- deterministic completion hook.

Inspect persistence for duplicates/stale state.

### Campaign 047 — persistence/migrations/backup

This is a stop-the-line area.

Data corruption, migration failure, duplicate irreversible writes, broken backup/restore, or broken workout/session identity blocks progression until resolved or safely isolated.

Use disposable data for destructive tests.

Do not weaken integrity checks.

### Campaign 048 — performance/reliability

Measure first.

Use bounded soak loops with recorded sample sizes.

Do not rewrite architecture for theoretical performance.

If Campaign 042 SQLite serialization is implicated in measured latency, investigate before optimizing.

Do not trade correctness for benchmark numbers.

### Campaign 049 — accessibility/responsive/system UI

Actually test the conditions claimed.

Automated screen-reader traversal is not human screen-reader UX validation.

Large text, compact devices, overlays/modals, focus order, reachability, target sizes, system UI return behavior, and state coverage are priority.

Repair reproduced issues only.

### Campaign 050 — integrated certification

This is a certification campaign, not a feature wave.

Do not add major product features.

Re-prove the final integrated SHA.

If human/iOS/store/physical boundaries remain genuinely unavailable, technical certification may still be possible, but the wording must remain technically scoped.

Do not let old campaign evidence substitute for current final-SHA checks where the product changed afterward.

---

## 7. Validation proportionality

Not every small campaign commit requires the full matrix, but campaign closure validation must match risk.

### Frequently

- focused tests;
- typecheck;
- lint;
- affected validators;
- source-state review.

### High-risk or campaign closure

- full Jest;
- repository validators;
- OpenSpec;
- registry/provenance/offline/secrets;
- native build/install;
- relevant native journeys;
- accessibility;
- persistence/relaunch;
- logcat/fatal review.

### Dependency/persistence changes

Use the broadest applicable matrix.

Do not casually combine dependency, persistence, schema, and visual changes in one checkpoint.

---

## 8. Git checkpoint protocol

After each completed campaign or meaningful partial:

1. inspect `git diff`;
2. remove transient artifacts/secrets;
3. run appropriate validation;
4. update evidence;
5. commit coherently;
6. fetch remote;
7. inspect divergence;
8. reconcile safely;
9. push `main` if repository policy allows;
10. verify relationship before continuing.

Do not:

- force-push;
- `reset --hard` unknown work;
- force checkout over unknown work;
- delete unknown files;
- hide dirty state;
- commit APKs/emulator data/giant traces without explicit repository reason.

---

## 9. Blocker policy — keep the night useful

Do not sit idle for hours on one external blocker.

After a bounded investigation:

- classify it;
- write evidence;
- checkpoint safe work;
- determine whether a later campaign is independent;
- continue if safe.

Examples:

- no independent human → document pending, continue;
- no iOS → document pending, continue;
- no authorized physical device → document pending, continue;
- ARTEMIS timeout → deterministic fallback;
- external GitHub pre-step failure → continue local/native work if product gates are healthy;
- store credentials unavailable → document boundary, continue.

Do **not** advance past:

- data corruption;
- irreversible duplicate writes;
- broken migration;
- broken backup/restore;
- reproducible unresolved startup NPE;
- broken core workout/session identity;
- release build cannot start;
- severe regression caused by current campaign.

---

## 10. Anti-premature-completion rules

A campaign is not COMPLETE because:

- code compiles;
- Jest passes;
- a single emulator run succeeds;
- one screenshot looks correct;
- ARTEMIS says pass;
- old docs say the work is done;
- a route exists;
- registry IDs enumerate;
- the release APK installs;
- an external blocker exists.

Completion requires evidence matching the campaign risk.

Skipped tests must be classified.

Unavailable platforms must remain unavailable.

Tooling failures must not be silently called product failures or product success.

---

## 11. Scope discipline

Broad autonomy does not mean broad churn.

You may:

- repair reproduced bugs in the active campaign;
- add focused regression tests;
- add deterministic QA hooks when they improve truthful validation and are properly bounded from production;
- improve evidence tooling;
- simplify obsolete code if current source/runtime proves it is dead and removal is within scope;
- correct roadmap details when current evidence shows a better path.

Do not:

- invent unrelated features;
- redesign already-certified surfaces without evidence;
- change scoring/economy/game mechanics casually;
- add unsupported cognitive/medical claims;
- perform major dependency upgrades;
- rewrite routing/storage architecture without demonstrated need;
- optimize theoretical problems.

---

## 12. Long-session context management

As the session grows:

- keep durable campaign evidence;
- maintain concise TODO/status notes;
- re-read current source instead of trusting compressed reasoning;
- re-check Git state regularly;
- avoid re-auditing unchanged areas unless needed for integration;
- use subagents for independent read-only lanes when useful;
- serialize overlapping writes.

If context quality degrades:

- stop adding scope;
- finish/validate the active coherent slice;
- write a precise handoff;
- commit/push safe work.

---

## 13. Required overnight handoff

Before the session ends for **any reason**, create/update:

`docs/redesign/evidence/overnight-043-050/OVERNIGHT_HANDOFF.md`

Required table:

| Campaign | Status | Product work | Validation | Commit/SHA | Remaining |
|---|---|---|---|---|---|
| 043 | COMPLETE/PARTIAL/BLOCKED | ... | ... | ... | ... |
| 044 | ... | ... | ... | ... | ... |
| 045 | ... | ... | ... | ... | ... |
| 046 | ... | ... | ... | ... | ... |
| 047 | ... | ... | ... | ... | ... |
| 048 | ... | ... | ... | ... | ... |
| 049 | ... | ... | ... | ... | ... |
| 050 | ... | ... | ... | ... | ... |

Also record:

- starting SHA;
- final SHA;
- validated product SHA(s);
- HEAD/origin relationship;
- final worktree;
- source files changed;
- tests/validators actually run;
- runtime(s) actually used;
- ARTEMIS status;
- computer-use status;
- external CI status;
- human validation status;
- physical Android status;
- iOS/VoiceOver status;
- signing/store status;
- unresolved defects by severity;
- accepted debt;
- uncommitted work;
- safest next action.

---

## 14. Final overnight verdict

Do not force a global green result.

Report the highest fully completed campaign and any later partial/conditional work.

Examples:

- `OVERNIGHT_COMPLETE_THROUGH_045_CAMPAIGN_046_PARTIAL`
- `OVERNIGHT_COMPLETE_THROUGH_048_CAMPAIGN_049_PARTIAL`
- `OVERNIGHT_COMPLETE_THROUGH_049_CAMPAIGN_050_CONDITIONAL`
- `OVERNIGHT_COMPLETE_THROUGH_050`

If 043 remains partial due only to manual platform boundaries but 044–050 complete, describe that accurately rather than pretending chronological completeness.

---

## 15. Core directive

Work deeply and autonomously while the operator is away.

**Observe first. Challenge stale documentation. Protect the technically certified core. Close release boundaries where the environment genuinely permits. Diagnose CI rather than masking it. Isolate dependency maintenance. Soak the 42-game catalog. Attack persistence and backup correctness. Measure reliability/performance. Harden accessibility and state coverage. Then certify the integrated final SHA. Commit and push durable progress. Continue to the next campaign when safe. Never fabricate completion. Reach toward Campaign 050, but prefer verified truth over superficial breadth.**
