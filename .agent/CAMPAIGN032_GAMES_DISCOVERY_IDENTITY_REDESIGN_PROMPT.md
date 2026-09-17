# Campaign 032 — Games Discovery & Game Identity Redesign

**Status:** READY FOR EXECUTION  
**Mode:** focused product implementation, native validation, and evidence-backed iteration  
**Repository:** `quantdale/brain-training`  
**Campaign 031 closure:** `CAMPAIGN_031_COMPLETE_READY_FOR_032`  
**Campaign 031 final pushed SHA at handoff:** `eb10f72`  
**Primary implementation scope:** `Games tab → discovery/search/filter/favorites → game cards → game detail → deliberate standalone game start`  
**Primary evidence output:** `docs/redesign/evidence/campaign032/**` and a Campaign 032 closure report

---

## 0. Mission

Implement the second production redesign slice defined by Campaign 029: transform the current Games experience from a dense catalog/recommendation utility into a clearer, more intentional discovery experience while preserving the complete 42-game catalog, generated registry, favorites, categories, mastery, lazy loading, offline behavior, and all game/workout correctness contracts.

The target mental model is simple:

`I want a suggestion → show me one or two good next choices with a reason`

or

`I know what I want → let me browse/search/filter all games quickly`

Campaign 032 is **not** a redesign of Progress, Profile, Rewards, economy, onboarding, workout selection, persistence, schemas, scoring, or the final global visual system. It is also not an excuse to rewrite individual game mechanics. The work is primarily about discovery hierarchy, card/detail composition, recommendation presentation, authored game identity, and the transition from browsing to intentional play.

The app should feel less like a database of 42 rows/cards and more like a curated training library where every game is easy to find, easy to understand, and visually memorable enough to distinguish without becoming noisy or childish.

---

## 1. Mandatory read order

Before editing product code, read and understand at minimum:

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. applicable instructions under `.agent/**`, `.agents/**`, `.claude/**`, `.opencode/**`, and equivalent agent instruction locations
4. `.agent/CAMPAIGN029_PRODUCT_REDESIGN_DISCOVERY_PROMPT.md`
5. `.agent/CAMPAIGN030_RUNTIME_BASELINE_READINESS_PROMPT.md`
6. `.agent/CAMPAIGN030B_RUNTIME_VALIDATION_UNBLOCK_PROMPT.md`
7. `.agent/CAMPAIGN031_GOLDEN_PATH_REDESIGN_IMPLEMENTATION_PROMPT.md`
8. `docs/redesign/PRODUCT_REDESIGN_MASTER_PLAN.md`
9. `docs/redesign/PROPOSED_INFORMATION_ARCHITECTURE.md`
10. `docs/redesign/REFERO_REFERENCE_MAP.md`
11. `docs/redesign/evidence/campaign030b/CAMPAIGN029_VISUAL_CROSSCHECK.md`
12. `docs/redesign/evidence/campaign031/CAMPAIGN031_CLOSURE.md`
13. the current Games, Game Detail, registry/generated metadata, favorites, mastery, recommendation/discovery, theme/UI-kit, and route tests

Do not assume Campaign 029 descriptions still exactly match source after Campaign 031. Re-inspect current `main` before editing.

---

## 2. Non-negotiable scope boundaries

### 2.1 Authorized product work

Campaign 032 may change, where justified:

- the Games tab composition and hierarchy;
- recommendation/discovery components used by Games;
- game cards and their metadata density;
- search/filter/favorites presentation and interaction hierarchy;
- Game Detail hierarchy and presentation;
- authored game identity metadata/presentation seams that are purely presentational and do not alter mechanics;
- shared presentation primitives only when needed for the Games experience and when the change is safe for existing callers;
- tests/snapshots/fixtures directly required by the authorized redesign;
- documentation/evidence under `docs/redesign/evidence/campaign032/**`;
- campaign state/docs required by existing repository governance.

### 2.2 Explicitly out of scope

Do **not** intentionally redesign or materially change:

- Home/Today golden path established by Campaign 031, except for compatibility fixes if Games changes create a regression;
- Progress IA or charts;
- Profile/Rewards grouping;
- XP, levels, coins, streaks, quests, achievements, cosmetics, reroll economy, Spotlight economy, or reward semantics;
- SQLite schema, migrations, backup format, export/restore behavior;
- scoring, generators, reducers, game rules, timers, difficulty algorithms, or session semantics;
- workout selection/provenance/persistence;
- generated registry semantics unless a presentation-only metadata addition is proven necessary and generation remains deterministic;
- dependency versions, Expo SDK patch drift, CI workflow files, GitHub Actions configuration;
- global design-system replacement or broad theme/token overhaul;
- Campaign 033 Progress work;
- Campaign 034 Profile/Rewards work;
- Campaign 035 final visual/motion hardening.

If an issue outside scope is discovered, document it. Do not silently absorb it.

---

## 3. Evidence discipline and anti-premature-completion rules

Do not declare success because the Games screen looks cleaner in one screenshot.

You must verify behavior and state across:

- default Games state;
- recommendation/suggested state;
- search active/inactive;
- category filters;
- favorites populated/empty;
- no-results state;
- game detail with no history;
- game detail with history/mastery where deterministic fixtures allow;
- standalone Play entry;
- offline mode;
- light and dark themes;
- representative small/large content conditions where practical;
- accessibility semantics and touch targets;
- catalog completeness and generated registry truth.

Treat every prior document or test as evidence, not absolute truth. If implementation contradicts docs, update the campaign evidence rather than forcing the app to match stale prose.

Do not fabricate human findings. If no independent participant is available, retain `PENDING` with a precise handoff.

---

## 4. Product target

The Games destination should support two explicit jobs.

### Job A — “Tell me what to play”

Present one primary **Suggested Next** area using existing recommendation evidence. It may show one or two games, but must explain the recommendation in plain language using real stored/product evidence such as:

- not played recently;
- lower-trained domain;
- near a personal best;
- continue training;
- recent interest/favorite where supported;
- Spotlight only if it fits without competing with the primary model.

Do not use vague claims like “best for your brain” or unsupported benefit language.

### Job B — “I want to choose”

Provide a clear **Browse All** path with:

- search;
- eight existing primary domains/categories;
- favorites;
- all 42 games;
- fast reset/clear behavior;
- result count where useful;
- stable ordering and deterministic behavior.

Search/filter controls should behave as tools, not dominate the screen when the user is simply looking for a suggestion.

---

## 5. Required Games-tab redesign

### 5.1 Default hierarchy

The default Games screen should approximately follow this hierarchy:

1. page identity / short purpose line;
2. Suggested Next / Continue Training area;
3. compact Browse controls;
4. category/favorite access;
5. Browse All catalog.

Avoid presenting three or more equally loud recommendation shelves. Campaign 029 specifically identified the current parallel recommendation shelves as an information-hierarchy problem.

### 5.2 Recommendation consolidation

The current signals such as Recommended for today, Near a personal best, and Getting rusty may remain as underlying logic, but their presentation should be consolidated into a single primary suggestion model.

If multiple recommendation reasons are available:

- rank or sequence them deterministically;
- show the reason in concise copy;
- avoid a wall of separate shelves;
- allow deeper exploration only as secondary detail/filter behavior.

Do not delete useful recommendation logic solely to simplify presentation.

### 5.3 Search and filters

Search should be immediately discoverable but not visually dominant by default.

When search/filter mode is active:

- compress or hide recommendation content appropriately;
- make the query/filter state obvious;
- show accurate result counts;
- provide one clear Reset/Clear action;
- preserve favorites/category state semantics intentionally;
- no-results state must explain why nothing matched and provide recovery.

Do not create hidden state combinations that users cannot understand or reset.

### 5.4 Catalog cards

Game cards should prioritize:

- game name;
- one short mechanic/interaction description;
- domain/category recognition;
- favorite state;
- one useful progress signal where appropriate (for example mastery or recent record), but not every available metric.

Do not make every card a miniature analytics dashboard.

### 5.5 Catalog completeness

All 42 generated registry entries must remain discoverable through Browse/Search/Category/Favorites logic, except where an existing source rule intentionally excludes an item from a specific recommendation/workout context.

The existing special case for `language-word-match` must remain truthful: it is catalog-visible and must not accidentally appear broken merely because it is excluded from a workout path by current source rules.

---

## 6. Game identity strategy

Every game should gain a restrained authored identity based on its real interaction verb, not arbitrary decoration.

Use a shared identity system that can scale to all 42 games. Suitable identity ingredients include:

- a compact motif/icon/shape;
- a mechanic verb;
- one short interaction sentence;
- restrained domain color use;
- optional small motion/sensory signature where already supported and where it does not delay play.

Do not create 42 unrelated micro-brands.

Do not use clinical or cognitive-benefit claims as identity.

Do not make domain color the only differentiator.

At minimum, explicitly validate the identity system across eight representative interaction families:

- Attention / visual search;
- Memory / recall;
- Speed / reaction timing;
- Math / structured equation input;
- Language / association or context;
- Logic / deduction;
- Flexibility / rule switching;
- Spatial / transformation.

Representative games may include the Campaign 029 set if still current, but verify current registry/source before relying on names.

---

## 7. Game Detail redesign

The first viewport should answer, in order:

1. What game is this?
2. What do I actually do?
3. What is my current relationship/history with it?
4. How do I start?

Recommended hierarchy:

- domain/identity motif;
- game name;
- concise mechanic sentence;
- tutorial/first-play note if relevant;
- one compact mastery/record state;
- one dominant `Play` action.

Below the fold, preserve useful evidence such as:

- sessions;
- best;
- average;
- trend/history link;
- recent sessions;
- next mastery milestone.

Do not require users to interpret deep analytics before deciding to play.

If Game Detail and Progress Game remain separate routes, Campaign 032 must not redesign Progress Game. Only ensure Game Detail has a coherent role and does not duplicate excessive data.

---

## 8. Refero/design-reference usage

Use the existing Campaign 029 Refero map as a starting point. Additional targeted Refero research is authorized if the current implementation problem requires it.

Research specific patterns such as:

- recommendation versus browse hierarchy;
- compact card identity;
- library/catalog browsing;
- search/filter activation;
- course/game detail with one dominant CTA;
- empty favorites/no-results states.

Do not perform generic “find pretty app screens” research.

Do not copy a competitor wholesale. Record what interaction/hierarchy principle is borrowed and why.

---

## 9. Runtime and accessibility validation

Use a disposable normal phone-oriented Android AVD. Do not touch user-owned emulators/devices unless explicitly authorized by the owner during the session.

Capture real rendered pixels and semantic trees for, at minimum, light and dark versions of:

- default Games;
- Suggested Next populated state;
- Browse All;
- active search;
- category filter;
- favorites empty/populated if deterministic fixtures allow;
- no-results;
- representative Game Detail;
- standalone game intro/start handoff.

Validate:

- nonblank framebuffer;
- route correctness;
- no clipping under tab bar/safe areas;
- touch targets;
- screen-reader labels/order;
- text scaling where practical;
- color-independent states;
- light/dark semantic equivalence;
- no new fatal/RedBox/invariant errors.

The two localized 43dp findings carried from Campaign 030B are out of scope unless Campaign 032 touches those exact controls. Do not hide them from final reporting.

---

## 10. Functional validation matrix

At minimum verify:

### Discovery

- Suggested Next renders valid existing games only;
- recommendation reason matches available evidence;
- recommendation selection can open Game Detail or Play as intentionally designed;
- recommendation refresh/state is deterministic where the current system promises determinism.

### Browse/search

- all 42 games are reachable;
- search finds known titles and relevant text according to existing semantics;
- category filters produce correct subsets;
- clear/reset restores the default state;
- no-results recovery works;
- scrolling remains usable with the full catalog.

### Favorites

- favorite/unfavorite remains persistent;
- Favorites view accurately reflects state;
- empty Favorites state is understandable and recoverable;
- no duplicate/ghost cards appear.

### Game Detail

- correct game metadata loads;
- Play starts the correct game;
- first-play/tutorial behavior remains intact;
- history/mastery values remain sourced from existing data;
- returning from play/result does not corrupt navigation context.

### Representative game families

Launch and complete or minimally exercise at least one representative game from each of the eight primary domains/families using existing deterministic QA controls where appropriate. Do not alter game mechanics to make the validation easy.

---

## 11. Technical contracts that must remain intact

Preserve and verify:

- generated registry determinism;
- `game.json` metadata integrity;
- lazy loaders/chunks;
- game IDs and route IDs;
- favorites persistence;
- mastery semantics;
- session/history queries;
- tutorial persistence;
- GameHost lifecycle;
- scoring/generator/reducer logic;
- workout eligibility rules;
- offline/source/security boundaries;
- semantic/test IDs used by QA where still applicable;
- no accidental schema or dependency churn.

If you add presentational identity metadata, ensure generation/validation remains deterministic and backward-compatible.

---

## 12. Tests and repository gates

Before closure, run the repository-appropriate full validation matrix, including at minimum:

- typecheck;
- lint;
- focused Games/GameCard/GameDetail/discovery/favorites tests;
- representative eight-family tests;
- full CI-mode Jest;
- registry/generation validation;
- provenance validators;
- offline/source/security/secrets validators;
- workflow hygiene;
- dependency audit;
- task ownership/affected-map/repository-state validators if present;
- OpenSpec validation;
- Android debug build;
- runtime-QA contract/self-tests;
- web export if still part of repository gates.

Do not weaken validators or remove assertions to obtain green status.

Expo Doctor patch drift and GitHub zero-step workflow failures are carried external/maintenance issues unless materially changed by this campaign. Do not “fix” them by broadening scope.

---

## 13. Human validation

If an independent participant is genuinely available, perform a short uncoached study covering:

1. Find something recommended to play and explain why it was suggested.
2. Find a specific known game by name.
3. Browse one domain and choose a game.
4. Favorite a game, then find it again through Favorites.
5. Open Game Detail and explain what the game requires before pressing Play.
6. Recover from a search that returns no results.

Record hesitation, wrong turns, task completion, and comprehension.

If no independent participant is available, create/update a Campaign 032 human-validation handoff with these tasks and mark it `PENDING`. Do not treat the agent/operator automation run as human usability validation.

---

## 14. Required evidence deliverables

Create `docs/redesign/evidence/campaign032/` with enough evidence to independently review the implementation. At minimum include:

- `CAMPAIGN032_CLOSURE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `BEFORE_AFTER_GAMES.md`
- `DISCOVERY_VALIDATION.md`
- `CATALOG_INTEGRITY.md`
- `GAME_IDENTITY_MATRIX.md`
- `RUNTIME_VISUAL_VALIDATION.md`
- `ACCESSIBILITY_VALIDATION.md`
- `HUMAN_VALIDATION_PENDING.md` or actual human validation results if genuinely obtained

You may add additional files if useful, but avoid documentation sprawl. The closure report must remain sufficient to understand the campaign without reading every supporting file.

Record actual paths/SHAs/run IDs where useful. Do not claim screenshots that were not captured or manual observations that were not made.

---

## 15. Before/after acceptance criteria

Campaign 032 is complete only if the evidence supports all of the following:

### Games hierarchy

- Default Games has one understandable suggestion area and one understandable browse path.
- Search/filter/favorites are discoverable without dominating the initial experience.
- Recommendation shelves no longer compete as equal primary surfaces.
- No-results and empty-favorites states clearly explain recovery.

### Catalog integrity

- All 42 current registry games remain discoverable according to intended catalog semantics.
- Category counts and filters are correct.
- Favorites persist correctly.
- `language-word-match` and any other special-case eligibility rules remain truthful.

### Game identity

- The identity system is consistent across the catalog rather than arbitrary per-game styling.
- At least eight representative domain/mechanic families are visually/semantically distinguishable without relying only on domain color.
- Identity does not delay or obscure Play.

### Game Detail

- A user can understand the mechanic and primary Play action before encountering deep history.
- Existing mastery/history data remains correct.
- Standalone Play launches the intended game and preserves tutorial/session behavior.

### Technical quality

- Full repository validation passes or any external/pre-existing failure is classified honestly.
- Native runtime screenshots are nonblank and route-verified.
- No critical accessibility regression is introduced.
- No schema, dependency, scoring, generator, workout, or persistence contract is unintentionally changed.

---

## 16. Git and execution safety

Before editing:

- inspect branch, HEAD, worktree, remotes, and divergence;
- synchronize with remote `main` safely;
- preserve any pre-existing local work;
- do not reset, force checkout, clean, or discard user changes;
- if concurrent remote commits arrive, reconcile them rather than overwriting them.

During implementation:

- keep commits coherent;
- do not rewrite shared history;
- do not force-push;
- do not use destructive Git recovery merely to get back to a clean state.

At closure:

- push all authorized implementation/evidence commits;
- verify `HEAD == origin/main`;
- verify `git status --porcelain` is empty;
- report exact final SHA.

---

## 17. Final verdict contract

Return one of exactly these campaign verdicts after all exit criteria are evaluated:

- `CAMPAIGN_032_COMPLETE_READY_FOR_033`
- `CAMPAIGN_032_BLOCKED`

Do not begin Campaign 033 in this session.

A valid completion report must include:

- starting and final SHAs;
- exact materially changed product/test files;
- what changed in Games discovery/card/detail/identity behavior;
- catalog/favorites/search/filter validation results;
- eight-family representative validation;
- native visual/accessibility evidence summary;
- full repository gate results;
- human validation status;
- carried-forward issues;
- confirmation that Campaign 033 was not started.
