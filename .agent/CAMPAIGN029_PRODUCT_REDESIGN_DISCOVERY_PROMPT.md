# Campaign 029 — Product Redesign Discovery & Master Plan

**Status:** READY FOR EXECUTION  
**Mode:** exhaustive discovery, runtime observation, product/UX research, and documentation-only planning  
**Implementation authorization:** **NONE**  
**Repository:** `quantdale/brain-training`  
**Primary output:** `docs/redesign/PRODUCT_REDESIGN_MASTER_PLAN.md`

---

## 0. Mission

Perform a deep, evidence-driven investigation of the entire Brain Training repository and the actual product it currently produces, then create a comprehensive product redesign master plan.

This is **not** a request to implement a redesign. Do not make application, source, test, dependency, build, configuration, persistence, schema, CI, or production behavior changes. The only repository changes authorized by this campaign are planning/evidence documentation under `docs/redesign/`.

The purpose of this campaign is to determine, from first principles and from current evidence, what the product should become and how a later implementation campaign should transform it.

The current working hypothesis is that the underlying game/workout/progression engineering may be substantially stronger than the user-facing product experience. Do **not** accept that hypothesis as fact. Test it.

The user specifically considers the current UI/UX/front end poor. Do not respond with a cosmetic reskin plan. Investigate whether the real problems are visual design, information architecture, feature density, hierarchy, interaction design, game presentation, product positioning, navigation, gamification complexity, or some combination of these.

---

## 1. Non-negotiable operating rules

### 1.1 Evidence over documentation

Do not blindly trust:

- `README.md`
- `AGENTS.md`
- `ONBOARDING.md`
- `.agent/**`
- `docs/**`
- `openspec/**`
- old campaign reports
- validation summaries
- comments claiming something is complete, correct, validated, green, polished, accessible, production-ready, or finished
- test names or snapshots merely because they exist

Treat all of them as leads that must be checked against current source, runtime behavior, current tests, current CI state, Git history, and other direct evidence.

When evidence conflicts, record the conflict. Do not silently choose whichever source makes the repository look healthier.

A useful truth hierarchy is:

1. current reproducible runtime behavior;
2. current source and generated runtime data actually used by the app;
3. current executable tests/validators and their observed results;
4. current CI/workflow results and logs;
5. Git history / blame / prior implementation evidence;
6. documentation and prior campaign assertions.

This hierarchy is guidance, not an excuse to ignore contradictions. Explain material contradictions explicitly.

### 1.2 No implementation

Do **not**:

- redesign or rewrite screens in application code;
- edit React Native/Expo components;
- change navigation;
- change game logic;
- change styling/tokens/themes;
- modify tests to demonstrate a proposed design;
- add/remove dependencies;
- modify package manifests or lock files;
- change persistence schemas or stored user data;
- change CI/workflows;
- fix unrelated bugs while investigating;
- refactor code because it looks messy;
- create a prototype inside the production application;
- weaken tests or guards;
- perform destructive Git recovery;
- force-push, rewrite history, or reset away user work.

If you discover a bug, record it with evidence and disposition in the plan. Do not fix it during this campaign.

### 1.3 Authorized writes

The only in-repository writes authorized are documentation/evidence files under:

`docs/redesign/`

Temporary runtime artifacts should preferably live outside the repository. If useful evidence must be retained in-repo, keep it under `docs/redesign/evidence/` and keep it reasonably sized.

Do not overwrite existing authoritative project documents merely to make them agree with your conclusions.

### 1.4 No invented observations

If a device, emulator, build target, GitHub API, Refero MCP, browser, image capture path, or other tool is unavailable, state that explicitly and continue using the strongest available evidence.

Never describe a screen as if you personally observed it at runtime when you only inferred it from code.

Tag important findings with evidence class where useful:

- **Observed** — directly reproduced at runtime.
- **Verified in source** — current executable/source path inspected.
- **Verified by test/CI** — observed current run/result.
- **Historical** — supported by Git history or old artifacts.
- **Inferred** — reasoned conclusion requiring later human/runtime validation.

### 1.5 Do not preserve existing decisions by default

You are not required to preserve existing:

- information architecture;
- screen layouts;
- navigation choices;
- terminology;
- visual identity;
- `Neon Arcade` direction;
- card/component structure;
- workout presentation;
- reward economy;
- coins;
- rerolls;
- XP;
- levels;
- mastery;
- milestones;
- streak presentation;
- Spotlight/challenges;
- achievements;
- analytics presentation;
- previous campaign decisions.

Preserve something only when current evidence and product reasoning justify it.

Likewise, do not remove something merely because the user dislikes the current UI. Separate useful systems from poor presentation.

---

## 2. Start-of-campaign integrity check

Before substantive work:

1. Confirm the repository is `quantdale/brain-training`.
2. Confirm the intended branch is `main` unless repository policy clearly says otherwise.
3. Record the starting commit SHA.
4. Inspect `git status --short`.
5. If pre-existing user changes are present, preserve them. Do not stash/reset/discard them without explicit authorization.
6. Record relevant tool/environment availability: Node/npm, Android tooling/emulator, Expo, GitHub CLI/API access, Refero MCP, browser/UI tooling, and any existing repository automation.
7. Read repository-level instructions such as `AGENTS.md` and relevant tool-specific instruction files, but apply the evidence rules above.

Do not spend the campaign trying to normalize an imperfect development machine. Record environmental limitations and continue where possible.

---

## 3. Repository-wide census and architecture reconstruction

Analyze the repository as a whole, not just the newest UI files.

Build a structured census covering at minimum:

- top-level repository structure;
- Expo/React Native app structure;
- routing/navigation;
- shared components;
- design system/theme/tokens;
- screen-level components;
- game registry and game metadata;
- game implementations and shared game SDK/framework;
- workout selection/generation;
- workout resume/completion flows;
- difficulty/adaptation systems;
- scoring/performance calculations;
- persistence/data model;
- profile/settings;
- onboarding;
- streak/progression/XP/level systems;
- rewards/coins/rerolls;
- mastery/milestones/achievements;
- challenges/Spotlight or analogous systems;
- progress/analytics/history systems;
- accessibility infrastructure;
- haptics/audio/motion/animation infrastructure;
- platform-specific behavior;
- automation/QA/runtime validation tooling;
- generated files and registries;
- tests and validators relevant to user-facing behavior;
- build/release/CI paths;
- documentation and OpenSpec history relevant to product/UI evolution.

Create a coverage ledger so a later reader can see what was inspected and what was excluded (for example generated binaries, vendored dependencies, caches, or irrelevant build output).

Do not claim an "entire repository" review if major source directories were skipped without disclosure.

Use Git history when useful. Inspect older UI/product-related commits and campaign artifacts far enough back to understand how the current product accumulated its present structure. Do not restrict historical research to only the most recent commits.

---

## 4. Establish the real current baseline

The source tree is not the product. Attempt to observe the current product.

### 4.1 Build and health baseline

Using existing repository-supported commands where possible:

- determine whether dependencies install/resolve cleanly;
- determine whether typecheck/lint/relevant validators pass;
- determine whether the current app can be built/launched;
- inspect current GitHub Actions/workflow state if available;
- investigate enough of any current CI failures to accurately classify them;
- do **not** fix failures in this campaign.

Record exact commands, results, and limitations.

### 4.2 Runtime observation

If practical, launch the current app and inspect actual rendered states. Use the existing repository automation where appropriate rather than inventing a new harness.

Attempt to observe/capture at least:

- first launch / onboarding;
- returning-user launch;
- Home/Today;
- workout start;
- workout resume;
- workout configuration/reroll path;
- game library;
- search/filter/favorites;
- game detail;
- game tutorial/instructions;
- representative gameplay across different game interaction types;
- pause/quit/abandon behavior;
- per-game result;
- next-game transition;
- workout completion;
- Progress overview;
- deeper Progress views;
- Profile/settings;
- rewards/achievements/milestones if surfaced;
- relevant empty states;
- loading/error states that are reproducible;
- light and dark themes if both are supported;
- small/large phone layouts if existing tooling makes this reasonable.

Do not create fake seeded data by altering production code. Use existing fixtures/dev paths only if they are already supported and safe.

If some states cannot be reached, record that as evidence rather than pretending coverage.

### 4.3 Current-head contradiction audit

Specifically compare:

- claims made in current/recent campaign and validation docs;
- actual current workflow/CI status;
- observed local validation;
- observed runtime behavior.

The goal is not to discredit prior work. The goal is to establish a trustworthy baseline for redesign.

---

## 5. Complete product-surface inventory

Create a user-facing surface inventory.

For each meaningful screen/module/system, record:

- purpose;
- primary user job;
- entry points;
- main actions;
- information displayed;
- dependencies on other systems;
- whether it appears in the critical path;
- cognitive/visual load;
- duplicated concepts;
- product value;
- current usability concerns;
- current implementation maturity;
- recommended disposition.

Use a disposition taxonomy such as:

- **Core — preserve and strengthen**
- **Core — structurally redesign**
- **Secondary — keep but de-emphasize**
- **Advanced — progressively disclose**
- **Merge/consolidate**
- **Hide from primary journey**
- **Candidate for removal**
- **Needs evidence before decision**

Do not protect a feature because substantial engineering effort was previously spent on it.

---

## 6. User-journey audit

Audit complete journeys rather than only isolated screens.

At minimum:

### Journey A — daily training

Launch → understand today's task → start workout → game intro → gameplay → result → next game → workout completion → exit/continue.

Measure qualitatively:

- number of decisions before training starts;
- number of competing CTAs;
- terminology burden;
- visual hierarchy;
- interruptions during training;
- feedback quality;
- completion satisfaction;
- whether the user always knows what to do next.

### Journey B — find and play a specific game

Launch → Games → discover/search/filter → game detail → start → finish → result.

### Journey C — understand progress

Launch → Progress → answer: "Am I training consistently, what am I improving at, and what should I work on?"

Determine whether the current product answers those questions or exposes implementation/analytics machinery instead.

### Journey D — change workout intent

Examples: shorter session, different skill focus, alternate workout, resume unfinished session.

### Journey E — first-time user

Install/launch → understand product premise → understand what data means → complete first useful session without external explanation.

---

## 7. Complexity and gamification audit

Investigate the combined mental model created by all progression/economy systems.

Explicitly map interactions between:

- streak;
- XP;
- levels;
- mastery;
- milestones;
- achievements;
- rewards;
- coins/currency;
- rerolls;
- challenges/Spotlight;
- workout completion/progression;
- domain ratings/scores;
- personal bests;
- historical analytics.

For each system ask:

1. What user behavior is it trying to encourage?
2. Is its value understandable without documentation?
3. Does it duplicate another system?
4. Does it improve training motivation or merely add dashboard density?
5. Is it central enough to deserve persistent visual prominence?
6. What breaks if it becomes invisible or is removed from the primary experience?
7. Can the implementation remain while the UI expression becomes much simpler?

Produce a recommendation for the minimum coherent progression model. Do not assume all current systems should remain visible.

---

## 8. Refero research — mandatory if MCP is available

Use the Refero MCP as a serious research source, not as decoration.

Do not simply search "brain training UI" and stop.

Research specific UX problems separately, for example:

- daily training / next-action home screens;
- learning/training paths;
- workout launch cards;
- session-length selection;
- category discovery;
- searchable game/content libraries;
- game detail pages;
- compact tutorials;
- focused interactive/gameplay states;
- per-session results;
- multi-step session completion;
- streak presentation;
- progress summaries;
- deeper analytics/progressive disclosure;
- achievements/rewards;
- onboarding;
- goal selection;
- empty states;
- mobile settings/profile;
- dark themes;
- premium playful visual systems for adults.

Investigate relevant products and adjacent categories where useful, including examples such as:

- Elevate;
- Lumosity;
- Brilliant;
- Duolingo;
- Quizlet;
- Promova;
- high-quality puzzle/brain-teaser products;
- habit/fitness products where they solve streak/progress presentation well.

Do not claim Refero contains a product or screen if it does not.

For each useful reference, record:

- source/product;
- Refero identifier/link/metadata available from the tool;
- exact pattern worth studying;
- why it addresses a Brain Training problem;
- what **not** to copy;
- where it could apply;
- confidence/relevance.

The result must be a **reference map**, not a mood board.

Avoid cloning one app. The target should develop its own product identity.

---

## 9. External product/evidence research

If web/research tooling is available, use current primary/official sources to verify relevant product mechanics rather than relying on memory.

Research competitors for product structure, not just screenshots:

- daily workout model;
- number and type of games;
- adaptive/personalized training claims;
- progression model;
- progress presentation;
- session duration;
- game discovery;
- onboarding;
- monetization only where it materially affects UX structure.

Also review the evidence boundaries around cognitive-training claims.

The redesign must avoid presenting unsupported medical, neurological, intelligence, age-reversal, or real-world cognitive-benefit claims as fact. Prefer precise statements grounded in the app's own stored training-performance data.

Do not turn this campaign into an academic literature review; gather enough evidence to define safe product language and positioning.

---

## 10. Product diagnosis

After gathering evidence, identify the root problems.

Separate findings into categories such as:

- information architecture;
- navigation;
- first-viewport hierarchy;
- feature density;
- redundant gamification;
- visual hierarchy;
- design-system over-expression;
- typography;
- spacing;
- color usage;
- component consistency;
- game identity;
- gameplay immersion;
- instruction quality;
- result/feedback quality;
- progress comprehensibility;
- content discoverability;
- onboarding;
- accessibility;
- performance/responsiveness;
- technical constraints that materially affect UX.

Distinguish symptoms from causes.

For example, "too many cards" is not enough. Determine why so many cards exist, which systems compete for hierarchy, and which product decisions cause the screen to need them.

---

## 11. Define the target product

Create a clear product north star derived from the investigation.

A candidate direction to test, **not blindly adopt**, is:

> A premium cognitive gym: open the app, understand today's training within a few seconds, complete a focused short session, receive understandable feedback, and leave with a clear sense of accomplishment.

Determine whether the evidence supports this or a better formulation.

Explicitly state what the product should **not** become. Candidate anti-goals to assess include:

- generic arcade;
- clinical/medical dashboard;
- RPG economy wrapped around mini-games;
- random puzzle collection;
- analytics console;
- direct Elevate/Duolingo clone.

Define target audience assumptions and mark assumptions that require later user research.

---

## 12. Proposed information architecture

Develop the information architecture before proposing visual styling.

Evaluate a model approximately like:

- **Today/Home** — train now;
- **Games** — explore and deliberately choose games;
- **Progress** — understand training history/performance;
- **Profile** — identity, preferences, settings, secondary/meta systems.

This is a hypothesis, not a mandatory answer. Change it if evidence supports a better structure.

For every primary destination define:

- one sentence purpose;
- primary CTA/job;
- what belongs above the fold;
- what may appear contextually;
- what must not live there;
- what becomes secondary/deeper;
- navigation behavior;
- empty/loading/error behavior.

Explicitly resolve ownership of workout configuration, rewards, achievements, history, mastery, challenges, and economy UI.

---

## 13. Golden-path redesign specification

Design the core journey at wireframe/specification level before secondary surfaces:

**launch → Today → start workout → game intro/tutorial → gameplay → game result → next game → workout completion**

For every step specify:

- user objective;
- information hierarchy;
- primary and secondary actions;
- visible progress;
- navigation/back behavior;
- interruption behavior;
- error/resume handling;
- recommended content/copy structure;
- motion/haptic/audio role;
- accessibility considerations;
- what existing implementation can likely be reused;
- what likely needs structural redesign.

The plan should be concrete enough that a later implementation agent does not need to invent the product architecture from scratch.

Do **not** write production code or pseudo-code masquerading as implementation.

---

## 14. Games redesign specification

Determine how Games should feel like an intentional discovery experience rather than a database/catalog.

Evaluate patterns such as:

- recommended for you;
- continue training;
- skill/category rails;
- favorites;
- all games;
- search as a secondary utility;
- authored game identities;
- compact but useful detail views.

Inspect the real game catalog before deciding categories or groupings.

Develop a strategy for stronger individual game identity. Category color alone may not be enough. Consider illustration, iconography, motion language, environmental motifs, texture, typography, and interaction-specific presentation while keeping the global product coherent.

---

## 15. Progress redesign specification

Preserve valuable analytics capability without forcing all analytical machinery into the default experience.

Design a summary-first hierarchy that can quickly answer:

- How consistently have I trained?
- What areas appear to be improving based on my recorded game performance?
- What areas are stable/under-trained?
- What should I consider training next?

Then progressively disclose deeper analytics.

Map existing analytics to proposed levels such as:

1. overview;
2. domain detail;
3. game detail;
4. advanced history/analysis.

Do not discard sophisticated backend analytics solely to simplify the first viewport.

---

## 16. Visual and interaction direction

Only after IA and journey work is complete, define a proposed visual direction.

Audit the current theme/token system, including the current `Neon Arcade` direction, on its actual merits.

Determine what should be retained, restrained, or replaced across:

- color system;
- number of simultaneous accent families;
- neutral/background strategy;
- light/dark theme relationship;
- typography hierarchy;
- spacing rhythm;
- corners/shapes;
- elevation/borders;
- buttons and tactile affordances;
- cards/containers;
- iconography;
- illustration;
- game-specific art direction;
- data visualization;
- motion;
- haptics/audio;
- celebratory states;
- accessibility/contrast.

The redesign should not equate "better" with "more neon", "more futuristic", "more cards", "more animation", or "more features".

A possible reference synthesis to evaluate is:

- Elevate: adult cognitive-training premise and workout framing;
- Brilliant: focus on the current interaction/problem;
- Duolingo: clarity around what to do next and satisfying completion;
- Quizlet: visual restraint and hierarchy;
- Promova/adjacent premium learning apps: selective warmth and brand character;
- Brain Training's existing engine: differentiated game/workout foundation.

Treat this as a hypothesis to refine through Refero evidence.

---

## 17. Simplification/deletion plan

A redesign plan that only adds things is incomplete.

Create an explicit simplification table covering:

- features to preserve unchanged;
- features to preserve but visually demote;
- features to merge;
- features to move deeper;
- features to hide by default;
- features to remove from the user-facing product;
- systems that can remain internally but disappear from primary UI;
- obsolete/redundant UI/components likely removable during implementation.

For each deletion/demotion recommendation state:

- why;
- dependencies;
- user impact;
- migration risk;
- evidence needed before irreversible removal.

---

## 18. Codebase-aware implementation mapping

The eventual implementation plan must map proposed product changes back to the actual repository.

For every major redesign area identify:

- existing routes/screens involved;
- shared components involved;
- theme/design-system areas involved;
- state/data dependencies;
- persistence dependencies;
- analytics/progression dependencies;
- tests/automation likely affected;
- likely reusable assets/components;
- likely obsolete components;
- risky coupling;
- ordering constraints.

Do not prescribe exact code edits before confirming the actual implementation path.

Prefer architectural intent and affected areas over speculative line-by-line instructions.

---

## 19. Phased implementation roadmap

Create a staged implementation roadmap for a later campaign.

The first implementation phase should prioritize the **golden path**, not a repo-wide cosmetic sweep.

A reasonable structure to evaluate:

1. baseline/guardrails;
2. product shell + IA;
3. Today/golden-path workout launch;
4. game intro/gameplay shell/result/completion;
5. Games discovery;
6. Progress simplification/progressive disclosure;
7. progression/reward/economy simplification;
8. Profile/settings/secondary surfaces;
9. visual-system consolidation;
10. accessibility/performance/device hardening;
11. cleanup/deletion;
12. comprehensive validation and release candidate.

Change this ordering if code dependencies require it.

For each phase specify:

- objective;
- scope;
- prerequisites;
- expected files/subsystems;
- explicit non-goals;
- risks;
- validation gates;
- rollback boundary;
- completion evidence.

Avoid giant-bang implementation unless there is overwhelming evidence it is safer.

---

## 20. Human usability validation plan

Snapshots and automated tests cannot certify UX quality.

Define a practical human test plan for later execution.

At minimum, propose tasks like:

- start today's training without explanation;
- identify session duration/focus before starting;
- find a specific game;
- resume an interrupted workout;
- determine whether recent performance changed;
- change desired workout type/length;
- understand what streak/mastery/progress indicators mean.

Define what to observe:

- hesitation;
- wrong taps;
- backtracking;
- questions asked;
- time to first training action;
- ability to describe what progress means;
- comprehension of next action.

Do not invent usability-test results during this campaign.

---

## 21. Required deliverables

Create `docs/redesign/` if it does not exist.

### Mandatory primary deliverable

`docs/redesign/PRODUCT_REDESIGN_MASTER_PLAN.md`

This must be self-contained and should include:

1. executive summary;
2. campaign scope and methodology;
3. starting SHA and environment/tool availability;
4. evidence/coverage summary;
5. verified current product baseline;
6. CI/runtime contradictions or limitations;
7. repository/product architecture summary;
8. current surface inventory summary;
9. root-cause product/UX diagnosis;
10. current strengths worth preserving;
11. systems to simplify/demote/remove;
12. target product north star and anti-goals;
13. proposed information architecture;
14. golden-path specification;
15. Games specification;
16. Progress specification;
17. gamification/progression model recommendation;
18. visual/interaction design direction;
19. Refero-derived design principles with traceable references;
20. accessibility/performance principles;
21. codebase-aware implementation impact map;
22. phased implementation roadmap;
23. validation/usability strategy;
24. risks and unresolved questions;
25. explicit implementation-ready acceptance criteria.

The master plan must make sense without requiring the reader to reconstruct the argument from supporting files.

### Supporting deliverables

Create these when they materially improve traceability:

- `docs/redesign/CURRENT_PRODUCT_AUDIT.md`
- `docs/redesign/SURFACE_INVENTORY.md`
- `docs/redesign/REFERO_REFERENCE_MAP.md`
- `docs/redesign/RUNTIME_EVIDENCE.md`
- `docs/redesign/PROPOSED_INFORMATION_ARCHITECTURE.md`

Keep supporting documents evidence-heavy and avoid copying the same prose into every file.

---

## 22. Quality bar / anti-premature-completion gate

Do not declare the campaign complete merely because a long Markdown file exists.

Before completion, verify all of the following:

- The current commit SHA was recorded.
- Major source directories/subsystems were inventoried.
- Every primary app route was inspected.
- The game catalog/registry was inspected rather than guessed.
- Representative gameplay implementations were inspected, with coverage disclosed.
- Current Home/Today, Games, Progress, game detail, gameplay, results, workout completion, Profile/settings, and onboarding paths were investigated.
- Current CI/workflow health was checked if access existed.
- Runtime observation was attempted and actual observations are distinguished from inference.
- Git history was used to understand relevant prior product/UI evolution.
- Existing docs were cross-checked rather than trusted by default.
- Refero research was performed if the MCP was available.
- Refero findings are tied to specific Brain Training problems rather than pasted as generic inspiration.
- Competitor claims are sourced or clearly marked as uncertain.
- The plan contains removals/simplifications, not only additions.
- The proposed IA precedes visual styling decisions.
- The golden path is specified end-to-end.
- The roadmap is tied to real repository areas and dependencies.
- Human usability validation is included.
- No production/app/test/config/dependency code was changed.
- Any committed diff for this campaign contains only authorized `docs/redesign/**` documentation/evidence.

If meaningful gaps remain, list them explicitly and do not overstate certainty.

---

## 23. Completion and Git behavior

When the investigation and documentation are genuinely complete:

1. inspect the final working tree;
2. confirm no unauthorized files changed;
3. run documentation/repository integrity checks that are safe and relevant;
4. review the master plan for internal contradictions;
5. ensure claims are evidence-tagged or traceable where appropriate;
6. commit only `docs/redesign/**` outputs if repository policy and credentials permit;
7. push normally to `main` only if that is permitted by repository policy and the working tree is safe;
8. never force-push;
9. report the final commit SHA and exact deliverables.

If pushing is not permitted, leave the documentation ready in the working tree and report that accurately.

Do not modify `.agent/CURRENT_CAMPAIGN.md` as part of this execution unless separately instructed. This prompt itself is the execution directive.

---

## 24. Final response contract

The final CLI response should be concise relative to the produced documentation and must state:

- starting SHA;
- ending SHA, if a documentation commit was created;
- whether source/application code changed (**expected: no**);
- whether runtime observation succeeded and on what target(s);
- current CI/build health at the time of investigation;
- Refero availability and whether it was used;
- the largest verified product problems;
- the proposed product direction in a few sentences;
- the documentation files created;
- unresolved blockers/uncertainties;
- whether the documentation was pushed.

Do not claim "complete", "validated", or "ready to implement" unless the anti-premature-completion gate above is actually satisfied.

---

# Core directive

**Investigate first. Challenge assumptions. Observe the real product. Use current code and runtime evidence rather than historical claims. Research strong design references through Refero. Simplify the product before beautifying it. Produce an implementation-grade redesign master plan, but do not implement the redesign.**
