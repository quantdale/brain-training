# Campaign 031 — Golden Path Redesign Implementation

**Status:** READY FOR EXECUTION  
**Mode:** focused product implementation, native validation, and evidence-backed iteration  
**Repository:** `quantdale/brain-training`  
**Campaign 030B readiness commit:** `cb06df36af23b297a3815b6b1cbaa8d2f0da1a12`  
**Campaign 029 product baseline:** `5c484a08083963439360cb06c229249029f90531`  
**Readiness:** `READY_FOR_CAMPAIGN_031`  
**Primary implementation scope:** `Today/Home → Start/Continue → Game Intro/Tutorial → Gameplay Shell → Result → Next Game → Workout Completion`  
**Primary evidence output:** `docs/redesign/evidence/campaign031/**` and a Campaign 031 closure report

---

## 0. Mission

Implement the first production redesign slice defined by Campaign 029 and unlocked by Campaign 030B: the **golden path** from opening the app through completing Today’s Workout.

This campaign is not a generic visual refresh. It is a structural product redesign of the highest-value journey:

`Open app → understand Today → Start/Continue → understand the current game → play without distraction → understand the result → continue to the next game → finish the workout clearly`

The objective is to make that path dramatically easier to understand, calmer to use, more coherent, and more premium while preserving the mature game/workout/persistence engines already present in the repository.

The application already has strong underlying mechanics and state contracts. Do **not** treat those systems as disposable. Change the presentation and flow hierarchy aggressively where the evidence supports it; preserve correctness, persistence, determinism, provenance, offline behavior, scoring, session identity, and reward idempotency.

This campaign succeeds only if the redesigned golden path is demonstrably better than the Campaign 030B baseline **and** remains technically correct under native runtime validation.

---

## 1. Mandatory read order

Before editing product code, read and understand at minimum:

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. applicable instructions under `.agent/**`, `.agents/**`, `.claude/**`, `.opencode/**`, and equivalent agent instruction locations
4. `.agent/CAMPAIGN029_PRODUCT_REDESIGN_DISCOVERY_PROMPT.md`
5. `.agent/CAMPAIGN030_RUNTIME_BASELINE_READINESS_PROMPT.md`
6. `.agent/CAMPAIGN030B_RUNTIME_VALIDATION_UNBLOCK_PROMPT.md`
7. `docs/redesign/PRODUCT_REDESIGN_MASTER_PLAN.md`
8. `docs/redesign/PROPOSED_INFORMATION_ARCHITECTURE.md`
9. `docs/redesign/CURRENT_PRODUCT_AUDIT.md`
10. `docs/redesign/REFERO_REFERENCE_MAP.md`
11. `docs/redesign/REDESIGN_READINESS_REPORT.md`
12. all Campaign 030B evidence under `docs/redesign/evidence/campaign030b/**`
13. current source for Home, workout selection/resume, Game Detail/Intro, GameHost, Results, workout completion, shared shell/UI primitives, theme/motion, persistence, reward/rating/XP writes, and tests that protect them

Do not begin by rewriting components. Build a precise map of the current golden path and its state/data ownership first.

---

## 2. Evidence discipline

Campaign 031 must distinguish:

- **Observed baseline** — directly visible in Campaign 030B screenshots/runtime evidence.
- **Verified in source** — current implementation contracts.
- **Verified by test/runtime** — behavior proven at the implementation SHA.
- **Design decision** — a deliberate Campaign 031 product choice.
- **Human finding** — direct participant/manual observation, not agent intuition.
- **Open question** — unresolved and explicitly carried forward.

Do not claim that a redesign is clearer because the code looks cleaner. Do not claim that a screen is more usable because screenshots look modern. Runtime and task-level validation are required.

---

## 3. Scope boundaries

### 3.1 Authorized product changes

Campaign 031 may modify code, tests, styles, copy, shared components, and supporting documentation required to redesign the golden path, including:

- Home / Today composition and hierarchy
- Today’s Workout hero, status, progress, and primary CTA
- Start/Continue behavior presentation
- secondary workout configuration entry points used by Home
- reroll placement/presentation when necessary to support the new hierarchy
- Game Detail only where required by the golden path handoff
- game intro/tutorial framing
- shared GameHost chrome/HUD framing where it affects the golden path
- pause/interruption presentation where it affects continuity and confidence
- per-game Results hierarchy and actions
- Result → Next Game transition
- final Workout Completion presentation and action hierarchy
- bounded motion/haptics/audio treatment supporting these states
- tests and deterministic QA hooks needed to validate these changes
- documentation/evidence under Campaign 031

### 3.2 Not authorized in Campaign 031

Do **not** broaden this campaign into:

- Games tab discovery redesign
- full 42-game card/detail identity overhaul
- Progress architecture redesign
- Profile restructuring
- Rewards architecture redesign
- economy redesign or persistence deletion
- schema migrations unless a genuine golden-path correctness bug makes one unavoidable and is separately justified
- new currencies, new progression systems, new quests, new achievements, new social features, monetization, cloud accounts, AI features, notifications, or network dependencies
- large-scale visual-system replacement unrelated to the golden path
- dependency upgrades merely to clean Expo Doctor drift
- GitHub Actions workflow edits merely to address the existing pre-step external failure
- unrelated technical debt cleanup
- opportunistic refactors outside directly affected seams

If an out-of-scope defect blocks Campaign 031, isolate and document it. Do not silently expand scope.

---

## 4. Product north star

The redesigned path should satisfy this principle:

> **Open, understand today’s focused training in seconds, complete it without navigating a system maze, and leave with a trustworthy personal-performance insight plus an obvious next step.**

The user should not need to understand the product’s entire progression/economy model before pressing Start.

The dominant mental model must be:

1. **What should I do now?**
2. **What am I doing in this game?**
3. **How did that round go?**
4. **What happens next?**
5. **Am I finished?**

Everything else is subordinate during the golden path.

---

## 5. Required implementation outcomes

### 5.1 Home / Today

Recompose Home so the first screen has a single dominant purpose: begin or resume Today’s Workout.

Required direction:

- Today’s Workout is visually and semantically dominant.
- `Start workout` or `Continue workout` is the one obvious primary action.
- Show the minimum useful context near the CTA: workout length, current progress, and concise rationale where available.
- If a workout is in progress, show exactly where the player is: e.g. `2 of 4 complete`, current/next leg, and Continue.
- Keep streak/context compact rather than competing with the CTA.
- Move or demote reroll/configuration into a clear secondary path such as `Choose a workout` or equivalent.
- Do not make coins, XP, mastery, Spotlight, rewards, recent history, and configuration all appear equally primary.
- Lower-priority content may remain below the fold if still justified, but the first viewport must be unmistakable.

Do not delete underlying systems just to simplify the first viewport.

### 5.2 Start / Continue handoff

The transition from Home into a workout must feel deliberate and coherent.

- Show the selected plan in plain language.
- Make the number of games and expected duration obvious.
- Preserve current deterministic workout instance/provenance.
- Do not recreate or mutate a persisted workout merely because the presentation changed.
- Back/navigation before actual game start must not lose or duplicate workout state.

### 5.3 Game intro / tutorial

The player should understand the mechanic before play without reading a dashboard.

Required hierarchy:

1. game identity/title
2. one concise mechanic sentence
3. one example/tutorial affordance where needed
4. relevant difficulty/time context
5. one primary `Start game` action

Preserve tutorial persistence and existing first-use semantics.

Do not add unsupported “brain benefit” claims. Use action language such as “Find the one item that is different,” not medical/cognitive promises.

### 5.4 Gameplay shell

Gameplay should be focused.

- The game board/interaction remains primary.
- Show only essential timer/round/progress state.
- Keep one clear Pause affordance.
- Remove or suppress unrelated economy/reward/navigation competition during active play.
- Preserve every game’s actual mechanic, reducer/generator/scoring logic, session identity, pause/timer lifecycle, and deterministic QA contracts.
- Do not redesign 42 game mechanics in this campaign.

Shared shell changes must be tested against representative interaction families so a fix for one game does not degrade another.

### 5.5 Pause / interruption / relaunch

Campaign 030B proved these paths work. Campaign 031 must not regress them.

- Visible Pause and system back must have coherent behavior.
- Timers/lifecycle must freeze/resume correctly where the current engine specifies.
- Quitting must make consequences explicit.
- Relaunch must restore the persisted workout/session state according to existing contracts.
- No duplicate session writes, XP, rewards, ratings, or completion writes.

### 5.6 Per-game Results

Make Results concise and decision-oriented.

Required order:

1. completion/result headline
2. one or two understandable performance facts
3. bounded reward/progression feedback
4. one obvious next action

Inside an active workout, the primary action is normally `Next game` or equivalent. On the final leg, it becomes the workout-finish action. Outside a workout, use a context-appropriate `Play again` or `Done` hierarchy.

Use exact, defensible language:

- score
- accuracy
- time
- personal best
- recent average comparison
- XP actually awarded

Do not say or imply the user’s intelligence, brain health, age, diagnosis, or real-world performance improved.

Do not stack multiple celebrations so XP, streaks, quests, achievements, cosmetics, and rewards all interrupt the same transition.

### 5.7 Result → Next Game

This handoff must feel like a continuous workout rather than leaving the player to navigate back through the application.

- Show next game title/position.
- Preserve workout progress immediately.
- Do not require a Games-tab detour.
- Back before the next game starts must remain safe.
- Lazy-load/error paths must permit retry or return without corrupting the workout.

### 5.8 Workout Completion

The final state should feel complete, understandable, and calm.

Required hierarchy:

1. `Workout complete`
2. `4/4` or equivalent completion state
3. concise workout summary
4. one or two trustworthy personal-performance highlights
5. one primary next action

Secondary actions may include Progress, Browse Games, Rewards, or Done, but only one should read as primary.

Do not replay every per-game card or launch a cascade of reward overlays.

Completion must remain idempotent across revisit/relaunch.

---

## 6. Visual direction for this phase

Campaign 031 should move the golden path toward the Campaign 029 direction: a **calm, premium, kinetic cognitive gym**.

Do not perform a complete brand replacement. Work within the existing tokenized system unless a specific golden-path need justifies an adjustment.

Guidelines:

- one dominant action accent per state
- more neutral space around the primary task
- domain color as taxonomy/evidence, not simultaneous decoration everywhere
- fewer competing card surfaces
- clearer typography hierarchy
- rounded/tactile controls may remain, but not every object should be a pill/card
- motion explains state changes; it must not gate the CTA
- celebration is bounded and meaningful
- dark mode must preserve semantic equivalence, not become a separate composition
- large text, safe areas, touch targets, and reduced-motion/sensory settings must be preserved

Use Refero research from Campaign 029 as a reference library, not a cloning instruction. Additional Refero research is allowed only when a concrete implementation question is unresolved; do not restart broad inspiration research.

---

## 7. Baseline preservation and before/after evidence

Campaign 030B established a real rendered baseline. Before substantial implementation, inventory and preserve references to the baseline evidence for:

- Home light/dark
- representative Game Detail/Intro
- representative active gameplay
- Pause
- Result
- workout continuation
- workout completion

After implementation, capture equivalent states at the final implementation SHA.

The final Campaign 031 evidence must make before/after comparison possible without relying on prose alone.

Do not overwrite Campaign 030B evidence.

---

## 8. Implementation strategy

Use small, reviewable vertical steps. A recommended order is:

### P1 — Home / Today structural hierarchy

Implement the new first-viewport hierarchy and secondary workout entry points while preserving current workout data/state.

Gate before continuing:

- existing workout creation/resume tests pass
- Home renders correctly light/dark
- Start/Continue points to the same legitimate persisted workout behavior
- no reward/economy/persistence regression

### P2 — Intro / gameplay-shell focus

Simplify game-entry framing and shared active-play chrome without changing mechanics.

Gate:

- representative mechanic families still start/play/pause/finish
- timer/background/pause behavior remains correct
- tutorial state remains correct
- no lost semantic IDs needed by automation

### P3 — Results / Next transition

Recompose Results and establish the clear workout continuation action.

Gate:

- session is written once
- reward/XP/rating writes remain idempotent
- `Next` enters the correct unfinished leg
- revisiting Results cannot duplicate writes

### P4 — Workout completion

Implement the coherent final completion state and exit actions.

Gate:

- 4/4 is persisted correctly
- completion survives relaunch
- no duplicate reward/completion writes
- Home reflects completed state correctly

### P5 — integrated polish and validation

Only after the structural path works should typography, spacing, motion, bounded celebration, and visual refinement be tuned.

Do not start with P5.

---

## 9. Technical contracts that must remain intact

Treat the following as protected unless a proven defect requires a narrowly justified change:

- SQLite canonical local persistence
- schema/version semantics
- backup/restore compatibility
- workout instance identity
- workout provenance and deterministic selection
- completion/resume semantics
- game generator/scoring versions
- session identity and exactly-once behavior
- GameHost lifecycle/timers
- rating calculation contracts
- XP/currency ledger integrity
- reward/claim idempotency
- tutorial completion persistence
- registry/generated catalog determinism
- offline-first behavior
- semantic/test IDs used by QA
- accessibility labels/order contracts where currently correct

If implementation requires changing one of these contracts, stop and prove why. Do not casually “simplify” state architecture to make UI work easier.

---

## 10. Accessibility requirements

Campaign 030B recorded two localized 43dp findings. During Campaign 031:

- if either affected control is touched by Campaign 031 scope, bring it to the repository’s minimum target requirement;
- if not touched, carry it explicitly forward rather than widening scope solely to fix unrelated screens.

For all changed golden-path surfaces:

- minimum target size must meet repository requirements
- text scaling must not hide the primary CTA
- TalkBack/screen-reader order must match visual/action order
- state cannot rely on color alone
- loading/error/result changes need meaningful announcements where appropriate
- dark/light contrast must remain compliant
- reduced-motion/sensory settings must be respected
- semantic IDs required by deterministic QA must remain stable unless tests and harness are intentionally migrated together

---

## 11. Human validation requirement

Campaign 030B explicitly left human validation as `PENDING_PHASE_031`. Campaign 031 must address it.

If actual human participants are available, run a compact baseline-versus-redesign validation with at least these tasks:

1. open the app and identify what to do today
2. start or resume the workout
3. explain what the current game expects
4. pause and resume safely
5. interpret the result
6. continue to the next game
7. finish the workout and explain what happened

Record:

- hesitation / wrong first tap
- time to intentional Start
- places where the participant asks what to do next
- result comprehension
- confidence that progress is saved
- completion comprehension
- subjective density / calmness

Do not invent retention conclusions from a small formative study.

If actual independent participants are unavailable in the execution environment, do **not** fabricate human findings. Perform a clearly labelled manual operator validation and produce a `HUMAN_VALIDATION_PENDING` handoff with exact tasks to run later. Human validation pending alone does not automatically invalidate the implementation if all technical/runtime gates pass, but the closure report must say so explicitly.

---

## 12. Native runtime validation

Use a disposable normal phone-oriented Android AVD equivalent to the successful Campaign 030B setup. Do not touch a user-owned emulator/device unless the user explicitly authorizes it in the session.

At the final implementation SHA, prove with real pixels and semantic/runtime evidence:

- Home/Today light and dark
- Start/Continue
- in-progress workout state
- representative Game Intro
- tutorial path where applicable
- active gameplay
- Pause and resume
- per-game Result
- Result → Next Game
- later workout leg
- final Workout Completion
- relaunch/resume/persistence
- completed-workout Home state

Use deterministic QA controls where appropriate, but do not claim a user path was observed if only a synthetic route render was captured.

---

## 13. Required test/validation matrix

At minimum, run and record the repository’s applicable equivalents of:

- TypeScript typecheck
- lint
- focused unit/component tests for changed surfaces
- workout/persistence tests
- GameHost/results tests
- reward/XP/rating idempotency tests
- registry/provenance validation
- offline/security validators
- dependency audit
- task ownership / affected-map checks if required by repository governance
- OpenSpec validation
- QA self-tests
- native golden-path canaries
- light/dark visual evidence
- accessibility checks on changed surfaces
- relaunch/persistence replay
- full CI-mode Jest or repository-equivalent test suite before closure unless a documented repository policy permits a narrower final matrix

Do not weaken tests or change allowlists merely to make the campaign pass.

Existing Expo patch drift remains a separate maintenance concern unless a Campaign 031 change directly makes it worse. Existing zero-step GitHub Actions failures remain external/pre-step unless new evidence proves otherwise. Record them, but do not edit unrelated dependency/workflow configuration merely to obtain a green badge.

---

## 14. Regression families

At least these representative game families must be checked after shared-shell changes:

- visual search / odd-one-out style
- memory / recall
- reaction timing
- math/input construction
- language/content match
- logic/deduction
- rule switching/flexibility
- spatial transformation

You do not need to visually redesign each family in Campaign 031. You do need to prove shared chrome did not break them.

---

## 15. Failure handling

Do not hide blocked evidence.

If a runtime path fails:

1. determine whether the failure is product regression, test-environment failure, or harness failure;
2. preserve evidence;
3. fix only if inside authorized scope;
4. rerun the exact affected path;
5. report retries and final state.

If a redesign idea creates correctness risk, prefer the simpler product presentation that preserves the engine contract.

Do not force-push, rewrite Git history, discard local user work, reset unknown changes, or use destructive Git recovery to obtain a clean tree.

---

## 16. Required Campaign 031 deliverables

Create a focused evidence package under:

`docs/redesign/evidence/campaign031/`

At minimum include:

- `CAMPAIGN031_CLOSURE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `BEFORE_AFTER_INDEX.md`
- `GOLDEN_PATH_RUNTIME.md`
- `ACCESSIBILITY_VALIDATION.md`
- `HUMAN_VALIDATION.md` or `HUMAN_VALIDATION_PENDING.md`
- `REGRESSION_MATRIX.md`

Update the redesign/readiness documentation only where the implementation changes truth.

The closure must state:

- starting SHA
- final SHA
- exact source files materially changed
- exact golden-path behavior changed
- protected contracts verified
- runtime target used
- screenshots/evidence captured
- tests run and exact results
- human/manual validation status
- known remaining issues
- whether Campaign 032 may begin

---

## 17. Exit criteria

Return `CAMPAIGN_031_COMPLETE_READY_FOR_032` only if all of the following are true:

### Product flow

- Home has one dominant Start/Continue action.
- A player can understand workout status without interpreting multiple unrelated systems.
- Start/Continue enters the correct persisted workout.
- game intro/tutorial is concise and understandable.
- gameplay shell is focused and mechanics are preserved.
- pause/resume/relaunch remain correct.
- Results clearly explain what happened and expose one primary next action.
- Next Game continues the same workout correctly.
- final completion is coherent and idempotent.

### Correctness

- no duplicate session/reward/XP/rating/completion writes
- no workout/provenance corruption
- no schema/backup regression
- no offline regression
- representative games remain playable
- required automated gates pass

### UX/accessibility

- real pixel evidence exists for changed core states in light/dark
- changed primary controls meet touch-size/accessibility requirements
- screen-reader/semantic order remains coherent
- visual/action hierarchy is measurably or observably improved against the Campaign 030B baseline
- human validation is completed or explicitly handed off without fabricated findings

### Repository hygiene

- changes are committed and pushed
- `main` matches `origin/main`
- worktree is clean, except any explicitly pre-existing user-owned modification that was preserved and documented
- no unrelated dependency/CI/schema/features were mixed into the campaign

If any critical golden-path correctness or native-runtime gate is unresolved, return `CAMPAIGN_031_BLOCKED` with the blocker isolated precisely. Do not declare success based only on screenshots or tests.

---

## 18. Final instruction

Implement decisively, but do not confuse breadth with quality.

The purpose of Campaign 031 is not to make every part of Brain Training beautiful. It is to make the **single most important product journey** feel obvious, coherent, focused, trustworthy, and polished while preserving the strong engines already underneath it.

When in doubt, prefer:

- fewer simultaneous decisions
- one clear primary action
- exact copy over motivational ambiguity
- progressive disclosure over dashboard density
- continuity over navigation detours
- preserved correctness over clever refactoring
- observed runtime evidence over assumptions

Do not begin Campaign 032 in this session.