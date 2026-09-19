# Campaign 055 — Signal Arcade Desirability Pass

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Mode:** targeted visual/product refinement based on Campaign 052 acceptance evidence, with Campaign 054 as the protected technical baseline  
**Starting repository baseline:** `f59c066`  
**Validated executable product baseline:** `02a7ecb`  
**Primary evidence roots:**  
- `docs/redesign/evidence/campaign052/`
- `docs/redesign/evidence/campaign054/`
- new Campaign 055 evidence under `docs/redesign/evidence/campaign055/`

---

## 0. Mission

Campaign 054 closed the repository-owned technical gaps.

The next problem is no longer broad correctness.

It is product desirability.

Campaign 051 established a recognizable Signal Arcade visual language, but Campaign 052 showed that the strongest idea is not yet equally dominant across the experience. The app is coherent and technically solid, yet several surfaces still feel like a gamified dashboard rather than a compelling brain-training game product.

This campaign should **refine and deepen Signal Arcade**, not replace it wholesale.

The objective is:

> Make the app feel less like a dashboard wearing arcade colors and more like a cohesive, desirable cognitive game product.

Do not start another total visual reboot.

Do not throw away what works.

Do not change product mechanics or backend contracts merely to make screens look different.

Use current rendered evidence to decide what to keep, refine, rethink, or simplify.

---

# 1. Read the acceptance evidence first

Before changing source, read and inspect:

- `docs/redesign/evidence/campaign052/REVIEW_FOR_CHATGPT.md`
- `VISUAL_DEBT_MAP.md`
- `FIRST_IMPRESSION_REVIEW.md`
- `INDEPENDENT_VISUAL_CRITIQUE.md`
- `REFERENCE_REALITY_CHECK.md`
- the committed Campaign 052 screenshots and contact sheets
- Campaign 054 terminal ledger and final repository/runtime matrices

Do not rely only on prose.

Inspect the actual screenshots.

Re-run current native captures where useful so you are not implementing against stale pixels.

---

# 2. Protected technical floor

Campaign 054 is the protected baseline.

Do not regress:

- 0 unresolved repository-owned Critical/High/Medium correctness gaps;
- 564 passing suites / 6,726 passing tests;
- empty unexpected-console baseline;
- all five opt-in probes;
- 42-game persistence coverage;
- bootstrap recovery;
- route input envelope;
- SQLite integrity and schema v12;
- workout/session identity;
- reward/currency idempotency;
- migrations;
- backup/import/export;
- offline behavior;
- release startup;
- malformed-route recovery;
- OpenSpec strict validation;
- current dependency dispositions;
- current native/runtime QA contracts.

Any visual source change that threatens these contracts must be narrowed or reverted.

---

# 3. Campaign 052 visual debt is the starting map, not unquestionable truth

Campaign 052 classified:

### KEEP

- Active gameplay
- Dark mode

### REFINE

- Home / Today
- Game Detail
- Tutorial / intro
- Progress
- Rewards

### RETHINK

- Games discovery
- Results
- Profile

### REPLACE_DIRECTION

- None

Treat that classification as a starting point.

There is one meaningful tension in the evidence:

- the debt map says active gameplay is a KEEP;
- the independent critic still identified active gameplay as one of the weakest surfaces visually.

Resolve this honestly.

The interaction architecture and mechanic-first focus of gameplay should be protected.

You may improve its visual identity, tactile quality, spacing, and game-world expression if current native evidence supports doing so.

Do not redesign the mechanics.

---

# 4. Primary problems to solve

The following are recurring cross-product issues from Campaign 052.

## 4.1 Repetitive card grammar

Too many surfaces resolve into:

- eyebrow;
- large heading;
- rounded bordered card;
- metrics;
- full-width button;
- another rounded card;
- bottom navigation.

Break repetition without creating arbitrary inconsistency.

Cards should be used when they have a semantic role, not as the default container for every grouping.

## 4.2 Weak focal hierarchy

Several screens have too many simultaneous focal points.

Examples:

- Home: title, featured game, workout promise, progress, CTA, streak.
- Profile: identity, level, XP, streak, achievements, settings.
- Results: completion headline, score, metrics, reward, CTA.

Each major screen should have one unmistakable primary visual decision.

## 4.3 Game fantasy is weaker than game explanation

Current world art often behaves like an instructional diagram.

The games are understandable, but not always desirable.

Strengthen:

- game personality;
- challenge fantasy;
- visual metaphor;
- sense of "I want to try that."

Do this without generating 42 unrelated art styles.

The existing 8-domain world system should remain the scalable foundation.

## 4.4 Typography is too uniform

Page titles, section headings, game titles, completion states, and stat values frequently use similar bold sans hierarchy.

Create stronger role differentiation while preserving accessibility.

## 4.5 Shape system feels over-expanded

Current UI mixes:

- pills;
- soft cards;
- square-ish media frames;
- circles;
- rounded-square badges;
- folded-corner motifs;
- large rounded CTA controls;
- stat tiles.

Re-establish clear shape roles.

Do not flatten everything into one radius.

## 4.6 Color roles are insufficiently semantic

Current accent colors sometimes carry too many meanings.

Reclarify:

- primary action;
- domain identity;
- success;
- reward;
- mastery;
- warning/failure;
- decorative art.

Do not let a poor result visually look like success merely because a reward exists.

## 4.7 Copy still feels administrative

Campaign 052 called out phrases and outputs such as:

- "recorded movement";
- "next consideration";
- "Local player";
- "Indigo accent";
- raw floating timing such as `2948.3300000000745 ms`;
- duplicate completion/score messaging.

Refine visible copy where it is clearly product-facing and within scope.

Do not make unsupported cognitive/medical claims.

Do not change score semantics.

## 4.8 Shell stronger than games

The product personality currently peaks in the shell, but the games themselves should feel like the main attraction.

The games should own the product identity, not merely inherit it.

---

# 5. Target outcomes by surface

## 5.1 Home / Today — REFINE

Current problem:

The featured object is promising, but the screen still reads partly like a wellness/dashboard task list.

Target:

- one dominant visual object or challenge moment;
- Start/Continue feels inevitable;
- progress remains legible but subordinate;
- streak/reward context supports rather than competes;
- completed state does not devolve into a checklist;
- reduce equal-weight stacked sections.

The screen should answer:

> What should I play right now?

before it answers:

> What are all my stats?

---

## 5.2 Games discovery — RETHINK

Current problem:

The catalog proves breadth but becomes a long repeated stack of cards and metadata.

Target:

- stronger editorial/storefront pacing;
- game identity visible before metadata;
- varied but systematic presentation;
- less repeated "banner + badge + title + description + details" grammar;
- suggested games feel curated and desirable;
- browse-all remains efficient for 42 games;
- search/filter states remain powerful without pill-cloud clutter;
- category/domain identity remains coherent;
- scrolling performance remains strong.

The catalog should make users want to browse for several minutes.

Do not hide games behind excessive carousels or novelty layout that harms discoverability.

---

## 5.3 Game Detail — REFINE

Current problem:

Strong hierarchy and dominant Play, but the hero still explains more than it excites.

Target:

- preserve clear Play dominance;
- increase emotional/game-world pull;
- reduce lower-page analytics dominance;
- make Records/mastery/history visibly secondary;
- make the game feel like an experience rather than a lesson specification.

---

## 5.4 Tutorial / Intro — REFINE

Current problem:

Clear but form-like and text-heavy.

Target:

- one mechanic concept at a time;
- more anticipation;
- less explanatory card density;
- stronger visual continuity with the actual game;
- faster path into play;
- preserve accessibility and truthful rules.

Do not remove necessary instructions for style.

---

## 5.5 Active gameplay — PRESERVE ARCHITECTURE, IMPROVE IDENTITY WHERE JUSTIFIED

Current strength:

- game is the main event;
- chrome recedes;
- state and feedback are legible.

Current weakness from independent critique:

- some mechanics still look like polished control panels or prototypes;
- generic cells and pale panel grammar can reduce excitement.

Target:

- preserve mechanic-first architecture;
- increase game-specific visual character;
- make answer/selection states feel more tactile;
- use space more intentionally;
- avoid large dead zones;
- maintain performance and accessibility.

Validate representative games across all eight domains if shared GameHost/gameplay primitives change.

---

## 5.6 Results — RETHINK

Current problem:

Completion is technically complete but emotionally weak.

Metrics often dominate.

Low-score outcomes can look like a report of failure with a reward attached.

Target:

- one emotional peak;
- clear result meaning;
- honest distinction between:
  - performance;
  - completion;
  - reward earned;
- remove duplicate score/completion statements;
- no raw debug-looking timing;
- metrics become supporting evidence;
- Replay / Next / Done hierarchy is unmistakable;
- workout completion feels meaningfully stronger than a normal result;
- reduced-motion path remains excellent.

Do not fake celebration for poor performance.

Encouragement can be positive without misrepresenting outcome.

---

## 5.7 Progress — REFINE

Current problem:

Credible but analytics-heavy.

Target:

- retain factual clarity;
- reduce report-software feel;
- stronger visual narrative around consistency and progression;
- quieter controls;
- less administrative phrasing;
- domain identity used carefully;
- charts remain truthful;
- recommendations remain evidence-bounded.

Progress should feel motivating without becoming gamified misinformation.

---

## 5.8 Profile — RETHINK

Current problem:

Identity dissolves into a long record/settings document.

Target:

- first viewport clearly communicates player identity;
- level, streak, equipped accent/cosmetic, and meaningful progression feel owned;
- settings/data remain reachable but no longer visually define the profile;
- reduce nested stat-card density;
- remove placeholder/internal-sounding labels;
- player-facing identity language should feel intentional.

Do not create social/profile features that do not exist.

---

## 5.9 Rewards — REFINE

Current problem:

Mechanics are real but presentation feels inventory-like.

Target:

- stronger collectible desirability;
- larger/clearer object identity;
- locked/owned/equipped states remain obvious;
- collection progress feels satisfying;
- avoid emoji-as-final-product-art where it looks provisional;
- preserve exact economy semantics.

Do not inflate reward value or add new economy mechanics.

---

## 5.10 Dark mode — KEEP AND POLISH

Dark mode is one of the stronger parts of Signal Arcade.

Preserve authored dark-mode intent.

Fix only current observed problems such as:

- low tonal separation;
- heavy maroon/green combinations;
- lost motif contrast;
- dead areas;
- competing accent fields.

Do not turn dark mode into simple inversion.

---

# 6. Targeted Refero research is required

Use Refero again, but this is not a broad mood-board exercise.

Research only the surfaces that Campaign 052 identified as weak.

At minimum investigate:

- mobile game storefront/catalog;
- game detail with strong fantasy and one CTA;
- results/completion/celebration;
- player profile/identity;
- collectible/rewards presentation;
- motivating but credible progress;
- active-game HUD/board composition if gameplay needs refinement.

Use:

**styles → screens → flows where useful**

Do not copy a single product.

Do not rebuild the entire visual direction from scratch.

Required artifact:

`docs/redesign/evidence/campaign055/TARGETED_REFERO_RESEARCH.md`

Include exact references used and what was borrowed/rejected.

---

# 7. Image generation is optional but encouraged for high-value exploration

Use image generation only if it can materially help one of the weak areas.

Good candidates:

- richer domain/game-world concept studies;
- result-state emotional hierarchy concepts;
- collectible/reward object studies;
- Profile identity treatments;
- Games storefront composition studies.

Do not generate finished UI screenshots and blindly trace them.

Do not ship generated production assets unless:

- art direction is coherent;
- provenance is recorded;
- assets are optimized;
- the asset system scales.

Code-native visual systems remain preferred for core identity.

---

# 8. Establish a refinement lock before broad implementation

Before changing many surfaces, write:

`docs/redesign/evidence/campaign055/REFINEMENT_LOCK.md`

This should define:

- what Signal Arcade elements remain protected;
- which visual behaviors are being changed;
- card/container rules;
- shape roles;
- typography roles;
- color semantics;
- result-state emotional logic;
- game-world/art rules;
- Profile identity rules;
- Rewards collection rules;
- Progress credibility rules;
- dark-mode preservation rules.

Do not allow implementation to drift into another uncontrolled redesign.

---

# 9. Implementation strategy

Prefer shared system improvements over one-off screen hacks.

Potential shared areas include:

- surface/container variants;
- typography roles;
- result-state primitives;
- game-world art composition;
- collectible object presentation;
- profile identity header;
- catalog card/poster variants;
- stat hierarchy;
- spacing/density;
- action hierarchy;
- semantic color roles.

Do not create a new component for every screenshot.

Do not destabilize established routing, persistence, gameplay, or test IDs.

---

# 10. Product copy cleanup

Audit only visible product-facing copy touched by these surfaces.

Remove or improve:

- robotic phrasing;
- internal vocabulary;
- raw debug-like numbers;
- duplicate statements;
- overly analytical labels that weaken appeal.

Protect factual honesty.

Do not introduce:

- medical claims;
- IQ claims;
- intelligence improvement claims;
- brain-age claims;
- scientifically unsupported transfer claims.

Required artifact:

`docs/redesign/evidence/campaign055/COPY_AND_LABEL_AUDIT.md`

---

# 11. Native critique loops are mandatory

## Critique pass A — "Would I browse this?"

Focus on:

- Home;
- Games;
- Game Detail;
- Profile;
- Rewards.

Ask:

- Does the screen make me want to touch something?
- Is the game world visible before metadata?
- Is there one focal point?
- Is repetition obvious?
- Could this screen belong to any generic habit/learning app?

## Critique pass B — "Does play feel better than admin?"

Focus on:

- tutorial;
- gameplay;
- results;
- progress.

Ask:

- Is the mechanic more visually compelling than the dashboard?
- Does result feel like an event?
- Does Progress remain credible without feeling administrative?
- Is the next action emotionally and visually obvious?

## Critique pass C — "Did we over-style it?"

Check:

- saturation;
- clutter;
- animation;
- readability;
- screen-reader semantics;
- performance;
- card/grid density;
- dark-mode contrast;
- adult credibility.

Repair the strongest problems.

Required artifact:

`docs/redesign/evidence/campaign055/VISUAL_CRITIQUE.md`

---

# 12. Before/after evidence

Capture current baseline from `f59c066` before implementation.

After implementation, capture the same states on the final release artifact.

At minimum:

- Home;
- Games;
- Game Detail;
- tutorial;
- gameplay;
- Result;
- Progress;
- Profile;
- Rewards;
- dark Games;
- dark Result;
- completed workout.

Use the same emulator/device profile where possible.

Produce:

- before/after screenshots;
- contact sheet;
- concise per-surface comparison.

Required artifact:

`docs/redesign/evidence/campaign055/BEFORE_AFTER_REVIEW.md`

---

# 13. Accessibility and responsive constraints

Validate at minimum:

- normal phone;
- compact viewport;
- font scale 2;
- light;
- dark;
- 44dp target rules;
- scroll reachability;
- bottom nav;
- overlays/modals;
- reduced motion;
- decorative art hidden from a11y tree;
- text truncation;
- result action hierarchy.

Human TalkBack/VoiceOver quality remains manual unless genuinely performed.

---

# 14. Performance constraints

The refinement must not make the catalog or games sluggish.

Measure at least:

- Home first render;
- Games initial render;
- Games scrolling;
- Game Detail;
- representative GameHost;
- Result;
- Profile;
- Rewards.

If generated/bitmap assets are introduced, audit memory and decode cost.

Prefer vector/code-native art where possible.

---

# 15. Protected contracts

Do not alter without an independently reproduced product defect:

- game mechanics;
- scoring rules;
- timers;
- generators;
- difficulty semantics;
- 42 registry IDs;
- workout selection/progression;
- session/workout identity;
- provenance;
- XP;
- currency;
- rewards/economy behavior;
- schema v12;
- migrations;
- backup/import/export semantics;
- offline behavior;
- Favorites;
- tutorial persistence;
- sensory settings;
- route input envelope;
- bootstrap recovery;
- test signal gate;
- dependency dispositions.

A visual campaign must not reopen Campaign 054's closed gaps.

---

# 16. Validation during implementation

Run focused tests after every major shared primitive change.

Do not wait until the end.

At minimum:

- affected visual/component tests;
- route tests;
- GameHost tests if shared gameplay changes;
- Results tests;
- Profile/Rewards tests;
- accessibility tests;
- representative eight-domain game checks when applicable.

---

# 17. Final repository validation

Run the current authoritative matrix.

At minimum:

- full Jest;
- unexpected-console gate;
- opt-in probes where affected or required by policy;
- typecheck;
- lint;
- Expo Doctor;
- OpenSpec strict;
- repo-state;
- task ownership;
- affected-map;
- registry validation;
- offline;
- secrets;
- provenance;
- workflow hygiene;
- dependency audit;
- runtime QA contract;
- web export;
- Android debug build;
- Android release build.

The terminal test count may change legitimately if this campaign adds tests.

Record exact final counts.

---

# 18. Final native validation

Using the exact final release artifact, validate:

- Home ready/active/completed;
- Games default;
- search/filter;
- several visually distinct games;
- Game Detail;
- tutorial;
- gameplay;
- Result;
- four-game workout;
- Progress;
- Profile;
- Rewards;
- dark mode;
- compact;
- font scale 2;
- force-stop/relaunch;
- offline;
- invalid route;
- SQLite integrity;
- no duplicate session/reward/currency effects;
- no app fatal/ANR/SQLite marker.

If shared gameplay primitives changed, validate at least one representative game from each of the eight domains.

---

# 19. Required evidence packet

Create:

1. `docs/redesign/evidence/campaign055/CAMPAIGN055_CLOSURE.md`
2. `CURRENT_BASELINE.md`
3. `TARGETED_REFERO_RESEARCH.md`
4. `REFINEMENT_LOCK.md`
5. `SURFACE_CHANGE_MATRIX.md`
6. `COPY_AND_LABEL_AUDIT.md`
7. `VISUAL_CRITIQUE.md`
8. `BEFORE_AFTER_REVIEW.md`
9. `ACCESSIBILITY_RESPONSIVE_QA.md`
10. `PERFORMANCE_SANITY.md`
11. `FINAL_REPOSITORY_VALIDATION.md`
12. `FINAL_NATIVE_VALIDATION.md`
13. `ASSET_MANIFEST.md` if any new production art assets are introduced

---

# 20. OpenSpec

Use the repository's OpenSpec workflow for this campaign.

If Explore/Propose is available and useful, use it before implementation to lock the bounded visual-refinement scope.

Do not create a broad "redesign everything" proposal.

The OpenSpec change should express the current visual debt and protected Campaign 054 floor.

Run strict validation before closure.

---

# 21. Git behavior

Start from synchronized latest `main`.

Preserve concurrent/user work.

Use coherent commits, preferably grouped by:

- research/refinement lock;
- shared visual-system changes;
- Games/Home/Detail;
- Results/Profile/Rewards;
- Progress/tutorial/gameplay refinements;
- critique fixes;
- final QA/evidence.

Never force-push.

Before closure:

- fetch/reconcile safely;
- push;
- verify `HEAD == origin/main`;
- verify clean tracked worktree;
- preserve unrelated pre-existing untracked tool config.

---

# 22. Final verdict

Use exactly one:

### `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`

Only if:

- Campaign 052 RETHINK surfaces are materially improved;
- REFINE surfaces are meaningfully refined;
- no surface remains generically card-heavy without a deliberate reason;
- Games is more browsable/desirable;
- Results has a stronger emotional hierarchy;
- Profile reads as player identity;
- Rewards feel more collectible;
- Home has clearer focus;
- Progress remains credible;
- gameplay architecture remains strong;
- dark mode remains authored;
- before/after native evidence proves the change;
- final technical gates pass;
- no unresolved Critical/High/Medium regression remains.

### `CAMPAIGN_055_DESIRABILITY_PASS_PARTIAL`

Use when a substantial coherent refinement lands but one or more major visual-debt areas remain unresolved.

### `CAMPAIGN_055_BLOCKED`

Use if visual work causes unresolved product correctness, accessibility, performance, or release regressions.

---

# 23. Final CLI report

Report:

- verdict;
- starting SHA;
- final SHA;
- validated product/source SHA;
- final APK SHA-256;
- chosen refinement principles;
- Refero references actually used;
- whether image generation was used;
- major shared visual-system changes;
- surfaces changed;
- RETHINK surfaces before/after status;
- REFINE surfaces before/after status;
- strongest 3 final surfaces;
- weakest 3 final surfaces;
- remaining visual debt;
- final Jest counts;
- OpenSpec result;
- accessibility/responsive result;
- performance result;
- native validation result;
- defects found/fixed/open;
- whether backend/product semantics changed;
- HEAD/origin state;
- worktree state;
- safest next action.

---

# Core directive

**Do not replace Signal Arcade. Make it finally feel desirable.**

Reduce dashboard grammar.

Strengthen game fantasy.

Make Games worth browsing.

Make Results feel like an event.

Make Profile feel owned.

Make Rewards feel collectible.

Keep Progress credible.

Preserve the strong gameplay architecture.

Protect Campaign 054's technical floor.

The final product should feel less like a well-designed app that contains games and more like a game product that happens to be technically rigorous.
