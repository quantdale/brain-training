# Overnight Autonomous Execution — Campaigns 033–040

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** long-running autonomous implementation + observation + validation + durable handoff  
**Starting point:** Campaign 032 is complete; begin with Campaign 033  
**Target horizon:** continue sequentially as far as safely possible through Campaign 040  
**Completion expectation:** substantial validated progress; later campaigns may be PARTIAL  

---

## 0. Operator intent

The human operator is going offline for the night and explicitly wants useful development to continue rather than idling after one campaign.

You are authorized to work autonomously for the duration of the available session, using the repository, native runtime tooling, computer-use capabilities, ARTEMIS, ADB/UIAutomator/Maestro, GitHub tooling, Refero, browser/research tools, tests, validators, and any other available development tools that materially improve the result.

Do **not** wait for the human between Campaigns 033, 034, 035, 036, 037, 038, 039, and 040.

The preferred behavior is:

`033 → validate/checkpoint → 034 → validate/checkpoint → 035 → ... → 040`

However, campaign-number velocity is not the goal. If you reach Campaign 035 with strong validated work, that is better than superficially claiming Campaign 040. Partial later campaigns are explicitly acceptable.

---

## 1. Authoritative task files

Read and execute these files as a coupled contract:

1. `.agent/CAMPAIGN033_PROGRESS_DISCLOSURE_REDESIGN_PROMPT.md`
2. `docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md`
3. this file

Also read the repository's actual governing instructions and enough recent evidence to understand the current implementation.

If this file and the roadmap differ on product scope, use the more conservative interpretation unless current observed evidence proves a stronger action is needed.

---

## 2. CRITICAL: do not blindly trust documentation

This is a hard requirement.

Prior agents have produced documentation that may be stale, incomplete, internally inconsistent, or written against older SHAs. README text, `.agent` state, prior campaign closure reports, OpenSpec files, comments, screenshots, test snapshots, and historical audit claims must **not** be accepted as current truth merely because they exist.

For every campaign and every material conclusion, reconstruct current reality.

### Truth hierarchy

Use this confidence order:

1. **Current reproducible runtime observation** on the exact current implementation.
2. **Current source/current persisted state/current generated metadata.**
3. **Executable tests, validators, build output, deterministic QA.**
4. **Current external CI/API evidence.**
5. **Git history and previous artifacts.**
6. **Documentation/history narratives.**

When a lower-ranked source conflicts with a higher-ranked one, investigate and record the contradiction. Do not contort current implementation to make old documentation appear correct.

### Observation requirement

Before redesigning a major surface, observe it first whenever the environment makes that possible.

Before claiming a visual improvement, compare real pixels.

Before claiming persistence correctness, inspect persisted state or deterministic tests.

Before claiming accessibility success, run the relevant audit and inspect high-risk states.

Before claiming a user-flow improvement, actually execute the flow.

Before claiming a bug is fixed, reproduce or write a regression probe/test.

Never fabricate evidence to keep the overnight sequence moving.

---

## 3. Startup procedure

At session start:

1. Identify the repository root and read governing instructions.
2. Fetch remote `main`.
3. Inspect `git status`, branch, HEAD, worktrees, local-only commits, remote divergence, and any pre-existing user/concurrent work.
4. Synchronize safely. Prefer fast-forward. Never discard unknown work.
5. Record the actual starting SHA.
6. Inspect the latest Campaign 032 closure and the current source/runtime rather than assuming the closure perfectly describes HEAD.
7. Inventory tool availability:
   - Android SDK/emulator/ADB
   - existing dedicated AVDs
   - ARTEMIS
   - Maestro/UIAutomator
   - computer-use/browser capabilities
   - Refero
   - GitHub/network access
   - test/build tooling
8. Begin Campaign 033.

If remote `main` changes during the session, inspect the incoming commits before reconciling. Do not overwrite concurrent work.

---

## 4. Tool authorization and expected use

Use the strongest available tools when they improve confidence or velocity.

### Computer use

Computer-use/UI interaction is authorized for development and testing. Use it for tasks such as:

- native app observation;
- emulator interaction;
- screenshots/visual comparison;
- browser-based diagnostics;
- tooling that lacks a stable CLI path.

Do not use computer use to interact with unrelated personal data/accounts.

### ARTEMIS

ARTEMIS is explicitly encouraged because it is expected to be working on this repository.

Use ARTEMIS for suitable exploratory checks, dynamic journeys, adversarial investigation, or additional runtime evidence. But ARTEMIS is not authoritative by itself. Cross-check important findings with source/runtime/tests.

If ARTEMIS fails because of transport/provider/session configuration, diagnose it reasonably, then use deterministic fallback tooling instead of burning the night retrying indefinitely.

### Android runtime

Prefer a dedicated normal phone-oriented disposable AVD based on the successful Campaign 030B/031/032 pattern. Do not return to a known black-frame ATD setup merely because an old script references it.

Do not stop, wipe, install to, or send input to user-owned emulators/devices unless the current repository instructions explicitly identify them as automation-owned.

### Refero / external design research

Use Refero or targeted external research when a campaign genuinely benefits from current design references. Do not clone competitor screens. Use references to answer specific product problems.

### Credentials

Never commit credentials, API keys, tokens, session IDs, private traces, browser profiles, or secret-bearing logs.

---

## 5. Overnight execution strategy

### 5.1 Campaign 033

Execute `.agent/CAMPAIGN033_PROGRESS_DISCLOSURE_REDESIGN_PROMPT.md` fully.

If the final evidence-backed verdict is:

- `CAMPAIGN_033_COMPLETE_READY_FOR_034` → immediately start Campaign 034.
- `CAMPAIGN_033_PARTIAL` → decide whether the remaining blocker is localized. If Campaign 034 can proceed safely without building on broken Progress behavior, checkpoint 033 as partial and begin a bounded 034 slice. If not, continue repairing 033.
- `CAMPAIGN_033_BLOCKED` → determine whether the blocker is external/non-product. If so, you may still perform independent safe work from later campaigns, but do not represent 033 as complete and do not make changes that depend on the missing evidence. If the blocker is a severe product regression/correctness failure, repair or stop progression.

### 5.2 Campaigns 034–040

Use `docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` as the campaign fragmentation contract.

At the start of each packet:

- re-check current HEAD/worktree;
- observe the actual surfaces involved;
- write a short campaign plan/evidence note under `docs/redesign/evidence/campaign0XX/` before or alongside implementation if useful;
- establish a before state;
- identify protected contracts;
- implement the smallest coherent high-leverage slice;
- validate it;
- capture evidence;
- checkpoint/commit/push;
- decide whether to advance.

Do not create giant speculative rewrites spanning several campaign concerns at once.

---

## 6. Campaign-specific guardrails

### Campaign 034 — Profile / Motivation / Rewards

Allowed: Profile grouping, motivation hierarchy, Rewards ownership, settings/data discoverability, duplicate UI demotion/removal.

Protect: ledger, claim idempotency, streak reconstruction/protection, quests/achievements, cosmetics ownership/equip, backup/restore/export/delete safety.

Do not redesign Progress again unless repairing an actual 033 regression.

### Campaign 035 — Visual consolidation

Allowed: token/primitives consolidation, typography, spacing, surface hierarchy, card reduction, semantic color use, icons/motifs, charts, motion/celebration consistency.

Protect: hierarchy from 031–034, accessibility, semantic IDs, gameplay mechanics, performance.

Do not equate “premium” with more gradients, neon, animation, shadows, or cards.

### Campaign 036 — First-run / empty / trust

Observe a true clean-install path first.

Do not build a large onboarding flow unless observation supports it.

No account gate, forced reminder, health questionnaire, or unsupported cognitive-benefit marketing.

### Campaign 037 — Cross-surface state/navigation

Prioritize reproducible navigation/state bugs, return-context problems, duplicated ownership, loading/error/retry inconsistencies, deep-link failures, and stale components proven unused.

Do not use this as an excuse to rewrite routing architecture without evidence.

### Campaign 038 — Accessibility/device hardening

Actually test the conditions you claim. Large text, touch targets, safe-area/tab overlap, reduced motion, light/dark, screen-reader semantics, sensory toggles, and different device sizes are high priority.

Manual TalkBack/VoiceOver/physical-device claims require actual execution.

### Campaign 039 — Performance/reliability/maintenance

Measure before optimizing.

The deferred Expo patch drift may be handled here only as an isolated, evidence-backed maintenance slice. Keep dependency changes in dedicated commits and rerun full validation.

Do not edit CI workflows merely to hide external zero-step failures.

### Campaign 040 — integration/certification

Do not add major new product features. Re-observe and certify the integrated product produced by prior campaigns. Conditional/partial is acceptable.

---

## 7. Validation proportionality

Not every small commit needs the full release matrix, but every campaign checkpoint must have risk-appropriate evidence.

### Required frequently

- typecheck
- lint on changed surfaces/repo according to current scripts
- focused tests
- route/component regression tests
- current-source validators relevant to the touched seam

### Required at campaign closure or high-risk changes

- full Jest or current equivalent
- registry/catalog/provenance/offline/security/secrets validation
- repository-state/ownership/affected-map/OpenSpec/runtime-contract checks
- native build/install
- relevant native flow execution
- light/dark captures for materially changed visual surfaces
- accessibility audit
- persistence/relaunch checks where touched
- logcat/fatal-error review

### Required after dependency/schema/persistence changes

Use the broadest available validation and migration/backup compatibility checks. Do not combine these changes casually with unrelated visual work.

---

## 8. Native evidence rules

For every materially redesigned visual surface during the night:

- capture at least one representative light and dark state when practical;
- verify the screenshot is real/non-uniform and belongs to the intended route/state;
- preserve or index the corresponding semantic/UI tree when useful;
- compare against a before state or earlier current-baseline artifact;
- check clipping, tab overlap, reachability, text truncation, color hierarchy, and primary-action prominence.

Raw screenshot dumps may stay outside Git. Commit concise indexes and findings, not megabytes of uncurated evidence.

---

## 9. Human validation

If an independent human participant is genuinely available, use them according to the relevant campaign's task list.

If nobody independent is available overnight, do not invent human results. Maintain `HUMAN_VALIDATION_PENDING.md` or equivalent handoff records.

Computer-use agents, ARTEMIS, ADB automation, and the implementation agent itself are not independent human participants.

---

## 10. Git checkpoint protocol

The night may run for many hours. Avoid losing useful progress.

After each coherent campaign completion or meaningful partial slice:

1. inspect diff carefully;
2. run appropriate validation;
3. update evidence;
4. commit with a campaign-specific message;
5. fetch/check remote;
6. reconcile concurrent changes safely;
7. push `main` if repository policy permits;
8. confirm local/remote relationship;
9. continue.

Never:

- force-push;
- `reset --hard` over unknown work;
- discard user/concurrent changes;
- delete unknown files merely to obtain a clean status;
- falsify a clean worktree by hiding meaningful changes.

If the repo cannot safely be clean, document exactly why.

---

## 11. Anti-premature-completion rules

A campaign is not complete because:

- the code compiles;
- a unit test passes;
- screenshots look attractive;
- ARTEMIS says it is fine;
- an old document says the task was already implemented;
- one happy-path emulator run succeeded.

Before COMPLETE, require evidence matching the packet's real risks.

If tests are skipped, classify each skip. If a route is not observed, say so. If iOS is unavailable, say so. If external CI fails before steps, do not relabel it as product failure or success without evidence.

---

## 12. Scope control and self-directed judgment

You have broad autonomy to improve the repository within the roadmap, but you must exercise judgment rather than blindly following stale task lists.

You may:

- correct the roadmap's implementation details when current evidence shows a better approach;
- repair bugs discovered directly inside the current campaign's touched paths;
- add regression tests and QA hooks that improve truthful validation;
- simplify/remove obsolete UI when actual source/runtime proves it is redundant and dependencies are understood;
- create supporting docs/evidence needed for durable handoff.

You should not:

- invent unrelated features;
- rewrite stable game mechanics without evidence;
- make broad schema/economy changes because the UI is inconvenient;
- add new analytics/health claims;
- optimize theoretical problems without measurement;
- proliferate design systems/components instead of consolidating.

---

## 13. If blocked, keep the night productive safely

Do not sit idle on one external blocker for hours.

After a bounded investigation:

- classify the blocker;
- write evidence;
- commit any safe completed work;
- identify whether another campaign slice is truly independent;
- continue with that independent work if safe.

Examples:

- ARTEMIS provider outage → use ADB/UIAutomator/Maestro and continue if sufficient.
- external GitHub pre-step CI failure → continue local/native product work if product gates are healthy, but keep CI unresolved.
- no human participant → document pending validation and continue technical work.
- iOS unavailable → do not claim iOS validation; continue Android/web where supported.

Do **not** bypass blockers involving corruption, irreversible duplicate writes, migrations, broken backup/restore, severe navigation traps, or core session/workout correctness.

---

## 14. Long-session context management

As context grows:

- maintain concise campaign evidence and TODO state in the repo;
- prefer reading current source/evidence over relying on memory of earlier reasoning;
- periodically re-check `git diff`, HEAD, and campaign scope;
- avoid repeatedly re-auditing areas already verified unless changed;
- use durable Markdown checkpoints so a compressed/restarted agent can resume safely.

If you detect that reasoning context is becoming unreliable, stop adding new scope, checkpoint the current campaign, write a precise handoff, and push rather than making speculative changes.

---

## 15. Required overnight handoff

Before the session ends for any reason, create/update:

`docs/redesign/evidence/overnight-033-040/OVERNIGHT_HANDOFF.md`

It must contain a table like:

| Campaign | Status | Product work | Validation | Commit/SHA | Remaining |
|---|---|---|---|---|---|
| 033 | COMPLETE/PARTIAL/BLOCKED | ... | ... | ... | ... |
| 034 | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |
| 040 | ... | ... | ... | ... | ... |

Also include:

- starting SHA;
- final HEAD/origin relationship;
- final worktree status;
- tools actually used;
- ARTEMIS result/status;
- dedicated runtime(s) actually used;
- major observed before/after changes;
- exact unresolved blockers/regressions;
- uncommitted work, if any;
- safest next command/task for the next session.

---

## 16. Final overnight verdict

Do not force one global “success” label if the reality is mixed.

At the end, report:

- highest fully completed campaign;
- any later partial campaign(s);
- blocked/not-started campaigns;
- final SHA;
- whether `main == origin/main`;
- whether the worktree is clean;
- key validations passed/failed/pending;
- human validation status;
- external CI status;
- next recommended action.

Examples of acceptable endings:

- `OVERNIGHT_COMPLETE_THROUGH_036_CAMPAIGN_037_PARTIAL`
- `OVERNIGHT_COMPLETE_THROUGH_039_CAMPAIGN_040_CONDITIONAL`
- `OVERNIGHT_CAMPAIGN_033_BLOCKED_034_PARTIAL`
- `OVERNIGHT_COMPLETE_THROUGH_040`

The exact label matters less than truthful state.

---

## 17. Core directive

Work deeply and autonomously while the operator sleeps.

**Observe first. Challenge stale documentation. Preserve core correctness. Implement coherent slices. Validate the real app. Use ARTEMIS/computer-use and other tools when helpful. Commit and push durable progress. Continue into the next campaign when safe. Do not fabricate completion. Reach toward Campaign 040, but prefer verified progress over superficial breadth.**