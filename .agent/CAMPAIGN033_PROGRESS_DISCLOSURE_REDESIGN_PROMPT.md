# Campaign 033 — Progress Summary & Progressive Disclosure Redesign

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Starting state:** Campaign 032 complete at `6c9957b12d09e486b48a96d96588fe8b319cec51` plus the overnight-roadmap documentation commit on `main`  
**Mode:** bounded product implementation + native/runtime validation + evidence  
**Primary scope:** Progress overview, Progress drill-down ownership, sparse/history states, chart explanation, accessibility  
**Primary evidence output:** `docs/redesign/evidence/campaign033/**`

---

## 0. Mission

Redesign Progress so it answers the user's basic questions before exposing analytical machinery.

The target first-view mental model is:

1. **Consistency** — how much have I actually trained in the selected period?
2. **Recorded movement** — what does my stored personal performance history show, with appropriate uncertainty?
3. **Next consideration** — what domain/game may deserve attention next, and why?

The existing analytics depth is valuable. Do **not** delete it merely to make the first viewport simpler. Move depth behind intentional drill-down and make the overview comprehensible.

This campaign is not authorization to redesign Profile/Rewards, change the economy, rewrite analytics formulas, change schema, modify game mechanics, or begin Campaign 034 unless the overnight orchestrator explicitly advances after Campaign 033 closure.

---

## 1. Evidence-first rule — do not blindly trust docs

Prior campaign documents, `.agent` status, OpenSpec files, screenshots, tests, and comments may be stale or internally inconsistent. Treat them as historical guidance only.

Before making material changes, determine current truth using this priority:

1. reproducible current runtime observation;
2. current source and current persisted/query behavior;
3. executable tests/validators/builds;
4. current CI/API evidence;
5. Git history;
6. documentation.

If a doc claims something the current app does not do, document the contradiction and follow observed current behavior unless a higher-priority explicit repository contract requires otherwise.

Never infer visual hierarchy from source alone when real rendering is available. Never invent human findings, runtime screenshots, CI success, or accessibility success.

---

## 2. Mandatory read/observe set

Read the governing repository instructions and current redesign history needed to understand the seams, including at minimum:

- `AGENTS.md`
- `docs/PROJECT_CONSTITUTION.md`
- applicable `.agent/**`, `.agents/**`, `.claude/**`, `.opencode/**` instructions
- `docs/redesign/PRODUCT_REDESIGN_MASTER_PLAN.md`
- `docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md`
- Campaign 031 and 032 closure evidence

Then inspect and render the current Progress-related product surfaces before editing them.

At minimum map:

- `(tabs)/progress`
- Activity/history route(s)
- domain detail
- game progress/history route(s)
- ordinary Game Detail where it overlaps with progress/history
- 7d/30d/90d/all window logic
- ratings/mastery/freshness/trend queries
- chart components
- sparse/no-session states
- loading/error states
- offline behavior
- current accessibility/test IDs

Capture a before baseline on a dedicated disposable normal phone AVD if the environment permits. Reuse proven Campaign 030B/031/032 runtime practices rather than returning to the failed ATD image.

---

## 3. Product requirements

### 3.1 Overview hierarchy

The first meaningful viewport should prioritize, in order:

- period/window context;
- consistency/training-frequency answer;
- two or three concise evidence-backed personal metrics;
- one short interpretation of recorded movement;
- one next-consideration/domain focus with a plain reason;
- direct drill-down paths for users who want more detail.

Avoid a wall of cards, charts, mastery, PB history, category comparison, co-occurrence, and activity data all competing equally above the fold.

### 3.2 Consistency

Use real stored activity/session/workout data. Prefer understandable concepts such as trained days, completed sessions/workouts, and recent rhythm.

Do not imply that a streak or training count is itself proof of cognitive benefit.

### 3.3 Recorded movement

Use existing ratings, session metrics, recent averages, PBs, or comparable stored evidence only when the sample/window is adequate.

Distinguish:

- improving/declining/stable evidence when the existing calculation supports it;
- insufficient data;
- not trained recently;
- no sessions.

Do not turn sparse data into a confident trend.

### 3.4 Next consideration

A next-focus suggestion may use current freshness, training balance, rating movement, undertraining, or similar existing signals, but the UI must explain why in plain language.

Use language such as:

- “Not trained recently”
- “Fewer sessions this month”
- “Below your recent average”
- “Near a personal best”

Do not claim “your memory is weak,” “your brain improved,” “you need cognitive training,” or any medical/intelligence conclusion.

### 3.5 Progressive disclosure

Structure depth approximately as:

- **Level 1:** Progress overview — consistency, movement, next consideration.
- **Level 2:** domain detail — domain-specific recorded evidence.
- **Level 3:** game history/detail — records/trends/recent sessions for one game.
- **Level 4:** advanced history — activity calendar, PB history, comparison/co-occurrence/breadth and other analytical depth.

The exact route architecture must be based on current source and observed behavior, not the wording above.

### 3.6 Game Detail vs Progress Game overlap

Inspect both real routes/components. If they duplicate each other, choose the smallest coherent ownership improvement that reduces confusion without losing data or breaking deep links.

Acceptable outcomes include:

- merging evidence sections into ordinary Game Detail;
- renaming/reframing the progress route as “Game history”;
- preserving both routes but making their jobs clearly distinct.

Do not remove a route simply because an old plan called it redundant.

### 3.7 Empty/loading/error/offline states

Required states include:

- no sessions at all;
- sessions but insufficient data for a trend;
- a domain not yet trained;
- a game with no history;
- loading;
- recoverable query/persistence error where applicable;
- offline/local operation.

Errors must not silently render as zeros. Empty history should orient the user toward training, not display meaningless charts.

### 3.8 Charts

Every chart retained on a primary or detail surface should answer a user question. Pair charts with:

- window/sample context;
- accessible textual summary;
- plain explanation of what the axis/metric means;
- color-independent semantics.

Delete or demote charts that cannot justify their place in the current user journey, but preserve their underlying analytics if it remains useful elsewhere.

---

## 4. Accessibility and carried-forward debt

Campaign 030B recorded localized 43dp Progress Detail findings. Verify whether those exact issues still exist on current `main`; do not assume they do.

If they exist in Campaign 033-touched surfaces, fix them and validate minimum touch targets.

Also validate:

- semantic reading order;
- labels for window selectors, summary metrics, charts, and drill-down actions;
- large text/reflow where practical;
- color-independent trend/status meaning;
- light/dark parity;
- bottom-tab/scroll reachability.

Use automated audit plus actual native inspection when possible. Do not claim manual TalkBack success unless performed.

---

## 5. Technical protections

Preserve unless current evidence proves a defect that must be repaired within scope:

- SQLite schema and migrations;
- session identity and historical records;
- rating/mastery semantics;
- analytics query correctness;
- workout persistence/provenance;
- scoring/generators/reducers;
- registry/catalog generation;
- backup/restore/export formats;
- offline operation;
- semantic IDs relied on by QA;
- no-causation/claim boundaries.

If an existing analytics bug is discovered, isolate it, prove it with a regression test, and document why correcting it is necessary for truthful Progress presentation. Do not casually “simplify” formulas to fit the new UI.

---

## 6. Tool use

Use any available tool that materially helps, including repository search, Git history, Android emulator, ADB, UIAutomator, Maestro, ARTEMIS, computer-use/browser tooling, Refero, and test/build utilities.

ARTEMIS is encouraged for live exploratory/diagnostic validation if it is working, but it is not an oracle. Cross-check its findings against runtime/source evidence. If ARTEMIS is unavailable, continue with deterministic local tooling rather than blocking the campaign.

Do not commit credentials, tokens, raw private traces, emulator images, or unrelated machine data.

---

## 7. Validation matrix

At minimum, after implementation:

- focused Progress route/component/query tests;
- typecheck;
- lint;
- relevant analytics/rating/mastery tests;
- full Jest unless infeasible for a documented environment reason;
- registry/provenance/offline/security/dependency/workflow/repository-state/ownership/OpenSpec/runtime-contract validators as applicable;
- web export/build if part of current repository gates;
- Android debug build/install;
- native rendered light/dark captures for Progress overview and representative drill-downs;
- no-history/sparse-history evidence;
- populated-history evidence using deterministic existing fixtures/QA paths where possible;
- accessibility audit;
- logcat/fatal-error review.

Do not seed fake production data by altering source merely to make screenshots look populated. Use existing deterministic QA/dev fixtures or legitimate local test state.

---

## 8. Before/after evidence

Create `docs/redesign/evidence/campaign033/` with enough evidence to reconstruct what changed. Expected records include, as useful:

- `CAMPAIGN033_CLOSURE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `BEFORE_AFTER_PROGRESS.md`
- `PROGRESS_INFORMATION_HIERARCHY.md`
- `ANALYTICS_OWNERSHIP_MAP.md`
- `RUNTIME_VISUAL_VALIDATION.md`
- `ACCESSIBILITY_VALIDATION.md`
- `CLAIM_LANGUAGE_REVIEW.md`
- `HUMAN_VALIDATION_PENDING.md` when no independent participant exists

Do not bloat Git with raw emulator dumps when an indexed external artifact path plus concise evidence is sufficient.

---

## 9. Human validation

If an independent participant is genuinely available, test without coaching:

- “How consistently have you trained recently?”
- “What, if anything, changed in your recorded performance?”
- “What should you consider training next, and why?”
- “Show me more detail for one domain.”
- “Show me the history of one game.”

If no participant exists, produce the handoff and mark it pending. Do not treat the implementation agent operating the emulator as an independent usability participant.

---

## 10. Git/concurrency safety

- Synchronize safely before editing.
- Preserve concurrent/user work.
- Never force-push or use destructive recovery against unknown work.
- If remote `main` advances, inspect and reconcile.
- Commit coherent implementation/evidence checkpoints.
- Push only after validation appropriate to the checkpoint.

---

## 11. Completion gate

Campaign 033 is complete only when:

- current behavior was actually observed before redesign;
- Progress first-view hierarchy answers consistency, recorded movement, and next consideration;
- deep analytics remain intentionally reachable;
- sparse/no-history states are truthful;
- Game Detail vs Progress history ownership is clearer;
- relevant accessibility debt is addressed or explicitly carried with evidence;
- technical analytics/persistence contracts remain intact;
- native light/dark evidence exists;
- required validation passes or any external limitation is precisely classified;
- campaign evidence is committed and pushed;
- worktree is clean and `main` is synchronized.

Final Campaign 033 verdict must be exactly one of:

- `CAMPAIGN_033_COMPLETE_READY_FOR_034`
- `CAMPAIGN_033_PARTIAL`
- `CAMPAIGN_033_BLOCKED`

Do not invent `COMPLETE` to satisfy the overnight roadmap. If the overnight orchestrator is active and the verdict is `COMPLETE_READY_FOR_034`, proceed directly into Campaign 034 according to the roadmap.