# Campaign 051 — Visual DNA Reboot & Massive UI Overhaul

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** research-first visual exploration → reference lock → full frontend overhaul → native visual QA → regression certification  
**Starting point:** Campaign 050 closed conditionally after strong technical certification/hardening; current product logic/backend is considered protected unless current evidence proves a defect  
**Primary evidence root:** `docs/redesign/evidence/campaign051/`  
**Reference seed:** `docs/redesign/CAMPAIGN051_VISUAL_DNA_REBOOT_REFERENCE_LOCK.md`

---

## 0. Mission

The product is technically strong, but the operator is **not satisfied with its appearance, desirability, or visual identity**.

The current UI may be coherent and functional, but it does not create enough desire to keep using the app. It feels insufficiently stylish, insufficiently memorable, and too visually conservative.

This campaign explicitly authorizes a **massive frontend/UI overhaul**.

The target is not “polish the existing design.”

The target is:

> Build a visually memorable, desirable, playful, tactile cognitive-training product that feels like something users want to open again.

The product should feel like a **pocket cognitive arcade / training console** rather than:

- a clinical dashboard;
- a generic productivity app;
- a collection of white cards;
- a stale analytics surface;
- a Duolingo clone;
- a child-only toy.

It should be playful enough that a younger user is immediately curious, while still polished enough that an adult does not feel patronized.

The backend, workout engine, game mechanics, persistence, scoring, migration, backup, and technical contracts are not the problem. Protect them.

---

## 1. NON-NEGOTIABLE: research before implementation

Do not begin by changing colors in the existing theme.

Do not start with a generic “modern app” redesign.

Do not trust the current design system merely because previous campaigns validated it technically.

This is a **visual DNA reboot**.

### 1.1 Refero is mandatory

Use the connected Refero MCP and, if present in the agent environment, the `refero-design` skill.

Use the methodology:

**styles first → screens → flows → synthesis → reference lock → implementation**

You must perform fresh Refero research in this session even though a seed lock already exists.

At minimum:

- 3–5 style searches across genuinely different visual angles;
- retrieve 3–4 full style references;
- mobile screen research for Home, game discovery, game detail, gameplay/tutorial, results, progress, rewards/profile;
- at least one flow reference for learning/training progression or game/session progression.

Seed references already researched are in:

`docs/redesign/CAMPAIGN051_VISUAL_DNA_REBOOT_REFERENCE_LOCK.md`

You may keep, reject, or refine them based on better evidence.

Do not copy a single product.

Do not average multiple strong references into a safe middle.

### 1.2 Computer use is expected

Use computer-use capabilities when available to inspect the app as a user would.

Use it for:

- current app walkthrough;
- emulator interaction;
- visual baseline review;
- before/after comparison;
- checking motion and tactile feedback;
- spotting clipping/awkward density that static source review misses;
- final design critique.

Fallback to ADB/UIAutomator/screenshots when computer use is unavailable or inferior.

### 1.3 Image generation is expected when available

Use image generation where it materially improves the design outcome.

Strong uses:

- three visual-direction concept boards;
- Home/Games/Result mockups;
- 8-domain visual motif studies;
- game-poster/card art studies;
- result celebration concepts;
- textures/patterns/illustrations.

Do not use image generation to replace implementation judgment.

Do not bake actionable UI text into images.

Do not generate 42 unrelated illustrations with no system.

Production controls/charts/navigation must remain code-native and accessible.

If image generation is unavailable in this environment, document that and use Refero + code-native prototypes instead.

---

## 2. Read the seed reference lock

Read:

`docs/redesign/CAMPAIGN051_VISUAL_DNA_REBOOT_REFERENCE_LOCK.md`

Initial research anchors include:

### Styles

- Playdate — `c91209ef-f7f3-4d2b-bf69-41b58e4e2cc2`
- Duolingo — `9457a848-2905-4fe8-bb58-e168049120cf`
- Quizlet — `d6523b05-a53f-4a2a-8829-d65a5c3724e9`
- Stryds — `a3ea1c0a-56f4-420a-876e-9020474f83c4`

### Mobile screens

- Duolingo lesson complete — `aa871eca-62d2-4e49-bbf2-0ce2c16bd879`
- Brilliant lesson/problem — `234b08a9-2b30-4b48-a68c-0c1f0deb5994`
- Apple Games challenge — `5dd8a077-f1ae-43ee-a76e-dd4aeddcdcba`
- Mindllama collection — `ffb91263-59bd-4bea-993b-53bb936ff7ad`
- Body Coach workout detail — `211851b8-19b9-4236-af32-a36e3b7b67b7`

### Flows

- Brilliant personalized learning — `4316`
- Apple Games challenge creation — `9782`

The seed recommendation is a **Cognitive Arcade Console** direction:

- bold graphic language;
- tactile controls;
- game-poster/card identity;
- strong light/dark modes;
- collectible visual energy;
- crisp learning/training structure;
- no generic dashboard/card soup.

This seed is not immutable. Fresh visual exploration may prove a stronger direction.

---

## 3. CRITICAL: do not blindly trust documentation or previous visual claims

The current product must be observed again.

Previous screenshots, closure reports, visual baselines, design-system docs, and prior “premium” claims are evidence of history, not proof that the UI is desirable now.

Truth hierarchy for visual decisions:

1. current rendered native app;
2. current source/components/tokens;
3. current interaction behavior;
4. fresh Refero/image-generation references;
5. current accessibility/layout constraints;
6. previous design docs.

If old design guidance conflicts with what is visually desirable and technically safe, this campaign may replace the old visual system.

---

## 4. Git and runtime safety

Before editing:

- fetch remote;
- inspect branch, HEAD, `origin/main`, worktree, worktrees, stashes, local commits;
- preserve concurrent/user work;
- record starting SHA;
- inspect current build/runtime state;
- use only clearly automation-owned runtimes.

Never:

- force-push;
- reset away unknown work;
- force checkout over unknown changes;
- delete unrelated work;
- disturb user-owned emulators/devices;
- commit secret-bearing or giant transient assets.

Use coherent checkpoints because this campaign may be long.

---

# PHASE A — CURRENT VISUAL AUTOPSY

## 5. Observe the current app before redesigning it

Capture/inspect the current product in light and dark.

At minimum:

- Home fresh / active / completed;
- Games default;
- Games search/filter/favorites;
- Game Detail;
- representative intro/tutorial;
- active game;
- pause;
- per-game Result;
- workout completion;
- Progress sparse/populated;
- Progress drill-down;
- Profile;
- Rewards;
- Data Management;
- empty states;
- invalid/recovery states;
- compact viewport;
- font scale 2 where supported.

### 5.1 Audit the current design using explicit criteria

For each surface assess:

- desirability;
- first-impression impact;
- visual distinctiveness;
- hierarchy;
- perceived interactivity;
- game-like energy;
- emotional reward;
- typography;
- color discipline;
- shape/radius consistency;
- density;
- card overuse;
- iconography;
- illustration/motif use;
- motion;
- tactile feedback;
- light/dark authorship;
- younger-user appeal;
- adult sophistication;
- information credibility;
- accessibility;
- performance cost.

Identify what specifically makes the app feel boring.

Do not settle for vague statements like “needs more color.”

Examples of concrete diagnosis:

- too many same-weight rounded containers;
- no visual focal object on Home;
- game cards communicate metadata before fantasy;
- all surfaces share the same rhythm;
- result state lacks emotional peak;
- typography never changes scale enough to feel branded;
- domain color system is fragmented;
- motion is missing or generic;
- dark mode is a color inversion rather than a designed theme.

Required output:

`docs/redesign/evidence/campaign051/CURRENT_VISUAL_AUTOPSY.md`

---

# PHASE B — REFERO + IMAGEGEN VISUAL EXPLORATION

## 6. Produce three genuinely distinct visual directions

Do not implement the whole app before exploring.

Create three directions for at least:

- Home;
- Games;
- Game Detail;
- one GameHost gameplay state;
- Result;
- Progress.

Suggested families:

### Direction A — Cognitive Arcade Console

Bold, graphic, tactile, collectible, console-like.

### Direction B — Neon Training Lab

Immersive dark-first, luminous, technical, kinetic.

### Direction C — Animated Learning Studio

Bright, expressive, playful, illustration-forward.

These are prompts, not constraints. Fresh research may yield better names/directions.

### 6.1 Make the directions visually concrete

Use a combination of:

- Refero styles;
- Refero screens;
- Refero flows;
- generated concept images/mockups where available;
- quick code-native style spikes;
- screenshots composited into a mood board if useful.

The three directions must differ in:

- palette;
- typography personality;
- shape language;
- surface strategy;
- imagery/art strategy;
- motion philosophy;
- density;
- card treatment;
- game identity treatment.

Do not create three variations of the same design.

### 6.2 Score the directions

Evaluate each against:

- desirability;
- memorability;
- “I want to tap this” quality;
- child/teen curiosity;
- adult credibility;
- readability;
- accessibility;
- game-card strength;
- Home focal clarity;
- Results delight;
- Progress credibility;
- dark mode;
- implementation feasibility;
- performance;
- scalability to 42 games;
- originality;
- clone risk.

Then choose **one dominant direction**.

Do not average all three.

Required outputs:

- `docs/redesign/evidence/campaign051/REFERO_RESEARCH.md`
- `docs/redesign/evidence/campaign051/VISUAL_DIRECTIONS.md`
- `docs/redesign/evidence/campaign051/IMAGEGEN_EXPLORATION.md` if image generation is available

---

# PHASE C — LOCK THE NEW DESIGN DNA

## 7. Create the final reference lock before broad implementation

Write:

`docs/redesign/evidence/campaign051/REFERENCE_LOCK_FINAL.md`

It must state:

### Primary foundation

One dominant direction/reference family.

### Preserve

3–7 traits that must survive implementation.

### Borrow only

Specific secondary traits and their roles.

### Reject

Explicit visual defaults that would collapse the design back into generic AI/app styling.

### Token commitments

Define at minimum:

- light canvas;
- dark canvas;
- primary text;
- secondary text;
- primary action;
- secondary action;
- reward accent;
- success;
- warning;
- danger;
- border/divider;
- elevated surface;
- game/domain accent roles.

Do not reuse source hex codes blindly. Adapt into a unique product palette.

### Typography

Define:

- display;
- screen title;
- section title;
- body;
- compact UI;
- numeric/stat;
- button.

Use existing licensed/bundled fonts where practical.

Do not add proprietary fonts you do not have rights to distribute.

### Shape language

Define role-based radii:

- primary CTA;
- cards;
- chips;
- game art;
- modal;
- navigation;
- input.

Avoid one-radius-everywhere design.

### Depth

Define:

- flat;
- bordered;
- tactile bottom-edge;
- elevated;
- overlay.

Avoid generic shadow sprawl.

### Motion

Define:

- tap/press feedback;
- screen transition;
- card entrance;
- game feedback;
- success;
- reward;
- reduced-motion fallback.

### Media/art

Define:

- 8-domain art direction;
- per-game mechanic signature;
- illustration vs code-native motif rules;
- generated-asset rules;
- texture/background rules;
- icon style.

---

# PHASE D — DESIGN SYSTEM REBUILD

## 8. Rebuild/consolidate the frontend visual foundation

Before screen-by-screen churn, establish a real reusable system.

Audit existing theme/tokens/components first.

Then create or refactor as needed:

- semantic color tokens;
- typography tokens;
- spacing scale;
- radius roles;
- border roles;
- tactile/elevation roles;
- motion tokens;
- icon rules;
- game/domain identity tokens;
- light/dark palettes;
- illustration/motif primitives;
- shared button variants;
- shared surface variants;
- chips/tags;
- stat treatments;
- hero treatments;
- tabs/navigation;
- charts;
- empty-state treatment;
- skeleton/loading treatment.

Do not create a second design system beside the old one.

Migrate or replace deliberately.

Remove dead visual primitives only after proving they are unused.

---

# PHASE E — MASSIVE SURFACE OVERHAUL

## 9. Home / Today

Goal:

Opening the app should feel like opening a console and seeing today’s challenge.

Requirements:

- one unmistakable focal training object/hero;
- visually compelling Start/Continue;
- progress visible without looking like a dashboard;
- streak/XP/reward context supportive, not dominant;
- current/next game leg visually understandable;
- completion state should feel meaningfully different;
- strong light/dark identity;
- no pile of equal-weight cards.

Use a bold graphic motif, illustration, code-native visual, or generated asset only if it materially improves the focal moment.

---

## 10. Games

Goal:

The Games tab should feel like a desirable **game library/storefront**.

Requirements:

- game cards should look worth tapping before metadata is read;
- Suggested Next should feel curated;
- Browse All should feel rich, not database-like;
- domain/category should aid browsing without creating chip clutter;
- Favorites/search/filter/no-results remain excellent;
- game identity should be visually obvious;
- card art should scale across all 42 games;
- scrolling performance must remain good.

### 10.1 8-domain visual worlds

Create a coherent identity for all eight domains.

Each domain may own:

- accent pair;
- motif;
- shape/pattern;
- art treatment;
- icon family.

Per-game variation should derive from:

`domain visual world + mechanic signature`

Do not generate 42 disconnected visual systems.

---

## 11. Game Detail

Goal:

Sell the game fantasy/mechanic immediately.

Requirements:

- large game identity/hero;
- concise “what you do”;
- dominant PLAY;
- favorite secondary;
- difficulty/time if reliable;
- tutorial entry;
- history/mastery subordinate;
- stronger layout rhythm;
- responsive/large-text safe.

The user should understand why this game is interesting before seeing analytics.

---

## 12. GameHost / gameplay shell

Goal:

Gameplay should feel more immersive and less like a standard app page.

Requirements:

- app chrome recedes;
- mechanic gets the stage;
- progress/timer/hud coherent;
- tactile answer feedback;
- success/failure response;
- pause/tutorial accessible but not dominant;
- domain/game identity subtly present;
- no mechanic logic rewrite unless a bug is independently proven.

Shared GameHost visual changes must be validated across representative games from all eight domains.

---

## 13. Results / workout completion

Goal:

Results should create an emotional peak.

Requirements:

- stronger score/performance hierarchy;
- visually satisfying result moment;
- compact useful metrics;
- one dominant next action;
- replay/next/finish semantics preserved;
- celebratory animation or generated/code-native art where appropriate;
- reduced-motion fallback;
- rewards feel tangible without making unsupported cognitive claims.

The result screen should make another round feel appealing.

---

## 14. Progress

Goal:

Keep Progress credible while making it visually desirable.

Do not turn analytics into arcade decoration.

Improve:

- typography;
- chart framing;
- domain motif integration;
- selected accent use;
- hierarchy;
- progressive disclosure;
- empty/sparse states;
- comparison readability.

Charts must remain truthful and interpretable.

---

## 15. Profile / Rewards / Data

### Profile

Make it feel like the player’s console identity.

Avoid a long settings inventory.

### Rewards

Make rewards/achievements/cosmetics visually collectible and satisfying.

Use stronger objects/art, not just colored list rows.

### Data Management

Keep it calmer and more utilitarian than entertainment surfaces.

Do not compromise trust/destructive-action clarity for style.

---

## 16. Navigation

Reassess the bottom navigation and shared chrome.

The nav should belong to the new design DNA.

Requirements:

- obvious active state;
- tactile interaction;
- light/dark;
- large-text safe;
- safe-area safe;
- no gimmick that obscures labels/actions;
- preserve route semantics and automation IDs where feasible.

---

# PHASE F — MOTION, HAPTICS, DELIGHT

## 17. Motion

Introduce deliberate motion where it improves meaning.

Candidates:

- button press depth;
- card select/favorite;
- game start;
- answer feedback;
- progress advancement;
- result reveal;
- reward claim;
- tab transition;
- hero micro-motion.

Avoid:

- constant ambient animation;
- parallax for no reason;
- huge spring overshoot;
- motion on every card;
- motion that blocks input;
- expensive effects on low-end devices.

Respect reduced motion.

## 18. Haptics/audio

Use existing supported haptics/audio intentionally.

Do not add a new dependency casually.

Align feedback with:

- tap;
- correct;
- incorrect;
- completion;
- reward.

Respect sensory settings.

---

# PHASE G — VISUAL DESIGN CRITIQUE LOOPS

## 19. Mandatory critique pass 1 — “Is it still boring?”

After the first integrated implementation, stop coding and inspect real rendered screenshots.

Use:

- computer use;
- ADB screenshots;
- image comparison;
- independent read-only design critic subagent if available.

Ask:

- What still looks generic?
- Where is visual energy missing?
- Which surface could belong to any app?
- Which screen lacks a focal point?
- Which card treatments repeat too much?
- Where does color feel arbitrary?
- Which results/reward moments lack delight?
- Does dark mode feel authored?
- Would a younger user want to tap?
- Would an adult feel this is credible?

Repair the strongest problems.

## 20. Mandatory critique pass 2 — “Did we overdo it?”

Then ask:

- Is the UI noisy?
- Are too many things saturated?
- Is hierarchy weaker?
- Are analytics less credible?
- Are animations tiring?
- Are controls harder to discover?
- Are game cards too art-heavy?
- Did decoration replace information?
- Did we harm performance or accessibility?

Repair excess.

## 21. Mandatory critique pass 3 — reference-lock comparison

Compare final rendered implementation directly against the reference lock.

Record:

- preserved traits;
- drift;
- justified deviations;
- rejected drift repaired.

Required output:

`docs/redesign/evidence/campaign051/VISUAL_QA_AND_CRITIQUE.md`

---

# PHASE H — ACCESSIBILITY / RESPONSIVE / PERFORMANCE

## 22. Required UI QA

At minimum validate:

- light;
- dark;
- compact viewport;
- font scale 2;
- 44dp targets;
- safe areas;
- bottom-nav reachability;
- text clipping;
- modal/overlay focusability;
- loading/empty/error states;
- reduced motion;
- sensory toggles;
- offline;
- release build.

Automated accessibility must remain green for captured surfaces.

Do not claim human screen-reader quality unless a human actually performs it.

## 23. Performance

Visual improvement cannot make the app sluggish.

Measure representative:

- Home render;
- Games scroll;
- Games first load;
- Game Detail;
- GameHost start;
- result transition;
- Progress;
- Profile/Rewards.

Avoid large unoptimized images.

Optimize generated assets.

Do not introduce heavy blur/glass/particle systems without evidence the target runtime handles them.

---

# PHASE I — PROTECTED CONTRACTS

## 24. The visual overhaul must not regress technical foundations

Protect:

- all 42 game registry IDs;
- all 42 game mechanics;
- workout selection;
- workout instance identity;
- provenance;
- session lifecycle;
- scoring;
- difficulty;
- timers;
- reducer logic;
- rating history;
- XP;
- currency/reward idempotency;
- schema v12;
- migrations;
- backup/export/import;
- offline behavior;
- Favorites;
- tutorial persistence;
- sensory settings;
- SQLite serialized operation repair from Campaign 042;
- release startup;
- invalid-route recovery;
- semantic automation identifiers unless migration is deliberate and QA updated.

If a shared visual primitive touches all games, validate representative mechanics across all eight domains and run the all-42 lifecycle checks.

---

# PHASE J — TESTING AND CERTIFICATION

## 25. Focused validation during implementation

Run focused tests after each major lane.

Do not wait until the very end to discover that a shared component broke 30 screens.

## 26. Final repository matrix

At final source state run:

- full Jest;
- typecheck;
- lint;
- Expo Doctor;
- OpenSpec;
- registry validation;
- provenance;
- offline;
- secrets;
- task ownership;
- affected map;
- runtime QA contract;
- dependency policy;
- raw audit classification;
- web export;
- Android debug build;
- Android release build.

## 27. Final native matrix

At minimum:

- Home fresh/active/completed;
- Games default/search/filter/favorite;
- 42-card catalog reachability;
- Game Detail;
- representative game in each of 8 domains;
- intro/tutorial;
- gameplay;
- pause;
- Result;
- full four-game workout;
- Progress sparse/populated;
- Profile;
- Rewards;
- Data Management;
- invalid route;
- force-stop/relaunch;
- offline;
- light/dark;
- compact;
- font scale 2.

Inspect logs and persisted state after core flows.

---

# PHASE K — EVIDENCE

## 28. Required evidence packet

Create:

1. `docs/redesign/evidence/campaign051/CAMPAIGN051_CLOSURE.md`
2. `CURRENT_VISUAL_AUTOPSY.md`
3. `REFERO_RESEARCH.md`
4. `VISUAL_DIRECTIONS.md`
5. `IMAGEGEN_EXPLORATION.md` if image generation was available
6. `REFERENCE_LOCK_FINAL.md`
7. `DESIGN_SYSTEM_REBUILD.md`
8. `SURFACE_TRANSFORMATION_MATRIX.md`
9. `GAME_IDENTITY_SYSTEM.md`
10. `MOTION_HAPTICS_SYSTEM.md`
11. `VISUAL_QA_AND_CRITIQUE.md`
12. `ACCESSIBILITY_RESPONSIVE_QA.md`
13. `FINAL_REPOSITORY_VALIDATION.md`
14. `FINAL_NATIVE_VALIDATION.md`
15. `ASSET_MANIFEST.md` for any generated/new art assets

Raw screenshots may remain outside Git if large.

Commit concise indexes, hashes, and findings.

---

# PHASE L — GIT / CONCURRENCY

## 29. Checkpoint strategy

This campaign may involve many files.

Use coherent checkpoints:

- research/reference lock;
- token/design-system foundation;
- Home/Games/Detail;
- GameHost/Results;
- Progress/Profile/Rewards/Data;
- motion/assets;
- QA repairs;
- final evidence.

Do not produce one giant unreviewable dump if it can be avoided.

Before every push:

- inspect diff;
- remove transient artifacts;
- fetch;
- inspect remote;
- reconcile concurrent work safely.

Never force-push.

---

# PHASE M — FINAL VERDICT

## 30. Allowed verdicts

Return exactly one primary verdict:

### `CAMPAIGN_051_VISUAL_REBOOT_COMPLETE`

Use only if:

- fresh Refero research completed;
- three visual directions were explored;
- one direction was explicitly locked;
- the design system was materially rebuilt;
- all major product surfaces were transformed;
- current rendered before/after evidence shows a substantial visual difference;
- Games has materially stronger visual identity;
- Home has a clear memorable focal experience;
- Game Detail/GameHost/Results feel meaningfully more desirable;
- Progress remains credible;
- Profile/Rewards feel intentional;
- light/dark/compact/font-scale are validated;
- final repository/native gates pass;
- no Critical/High/Medium product regression remains;
- all protected backend/logic contracts remain intact;
- critique loops were completed.

### `CAMPAIGN_051_VISUAL_REBOOT_PARTIAL`

Use if a coherent large visual transformation landed but one or more major surfaces or required QA lanes remain incomplete.

### `CAMPAIGN_051_BLOCKED`

Use if the overhaul introduces unresolved correctness/accessibility/performance regressions or the runtime cannot be validated.

Do not claim complete merely because the theme changed.

---

## 31. Final CLI report

Report:

- starting SHA;
- final SHA;
- validated product SHA;
- verdict;
- chosen visual direction;
- Refero styles/screens/flows actually used;
- whether image generation was used;
- whether computer use was used;
- major token/design-system changes;
- surfaces transformed;
- generated assets;
- before/after visual summary;
- design critique findings and fixes;
- full Jest counts;
- build/validator results;
- native matrix counts;
- accessibility/responsive results;
- performance impact;
- all-42 / eight-domain validation result;
- full workout result;
- defects found/fixed/open;
- external/manual boundaries;
- HEAD vs origin/main;
- worktree state;
- safest next action.

---

# 32. Anti-premature-completion rules

Campaign 051 is **not complete** because:

- colors changed;
- a new theme file exists;
- Home looks nicer;
- three mockups were generated;
- Refero research was written;
- one screenshot looks good;
- the app compiles;
- Jest passes;
- dark mode looks cool;
- the agent likes the design.

The product must **visibly feel transformed across the whole experience**.

If the final screenshots still look like generic rounded-card mobile UI with a different palette, the campaign failed its primary mission.

---

# 33. Core directive

**Make the app desirable.**

Use Refero to establish taste.

Use image generation to explore stronger art direction when available.

Use computer use to judge the actual product rather than source code.

Give the app a memorable visual identity.

Make Home feel like today’s challenge.

Make Games feel like a game library.

Make Game Detail sell the mechanic.

Make gameplay immersive.

Make Results satisfying.

Make Rewards collectible.

Keep Progress credible.

Protect the technically proven backend.

Do not average strong references into blandness.

Do not stop at “clean.”

Do not stop at “consistent.”

The target is:

**distinctive, playful, tactile, polished, memorable, and worth reopening.**
