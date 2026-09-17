# Campaign 029 — Product Redesign Discovery & Master Plan

**Status:** Discovery complete; implementation authorization is **NONE**.
**Repository:** `quantdale/brain-training`
**Investigated head:** `13c0e5d85a270edb8e41a676437c6bdf3c81f441`
**Investigation date:** 2026-09-16
**Primary constraint:** this campaign changes documentation/evidence only. No product redesign is implemented here.

## Executive summary

Brain Training already has the hard product foundation: a real offline SQLite store, 42 mechanically distinct games, deterministic personalization, resumable four-game workouts, versioned scoring/provenance, a shared Game SDK, extensive test coverage, and a reusable theme/UI kit. The current weakness is the way that foundation is presented.

The app currently asks its four top-level surfaces to expose too many valid systems at once. Home is simultaneously Today, workout configuration, streak dashboard, reward status, Spotlight, mastery, recency, and history. Games is simultaneously recommendation engine, search/filter utility, category browser, and 42-item catalog. Progress is an analytics console before it is an answer. Profile is identity, streak management, quests, achievements, cosmetics, rewards, settings, and data portability in one long surface. The result is a product whose implementation maturity exceeds its user-facing hierarchy.

The recommended direction is:

> **A calm, premium cognitive gym that gets a player from opening the app to a focused, understandable training session in seconds, then turns the result into a clear next step.**

The redesign should keep the existing four tabs and core engines, but establish a strict hierarchy:

`Home / Today → Start or Continue → one game task → understandable result → next game → satisfying completion`

Games becomes intentional discovery; Progress becomes summary-first evidence with progressive disclosure; Profile becomes a grouped control center; Rewards becomes the single owner of claims and cosmetics. Gamification is compressed in the interface, not casually deleted from the persistence model. The current “Neon Arcade” tokens should be restrained into a warm, adult, kinetic training language: one action accent, semantic colors with jobs, authored game motifs, and bounded celebration.

This plan is implementation-grade in structure but is not implementation authorization. Its hypotheses must be validated on a working Android device and with human participants before a later campaign changes routes or components.

## Scope, methodology, and evidence discipline

### Scope

This campaign investigated the current repository, product surfaces, game catalog, shared architecture, historical UI/product evolution, local health, current GitHub Actions state, available runtime tooling, Refero references, official product/evidence sources, and a later implementation roadmap. It did not modify source code, tests, dependencies, build configuration, persistence/schema, CI, generated registries, or `.agent` durable state.

The repository was safely synchronized first: local `main` was clean at `609f8ec`, remote `main` advanced to `13c0e5d`, and an `--ff-only` merge produced the investigated SHA. No local user work was stashed, reset, discarded, or overwritten.

### Evidence tags

- **[Observed]** directly seen in current source, command output, or a current artifact.
- **[Verified in source]** confirmed by reading the current implementation, generated metadata, or test/harness contract.
- **[Verified by test/CI]** confirmed by an executed command or an explicitly identified CI/runtime record.
- **[Historical]** tied to an earlier commit/campaign and never substituted for current-head proof.
- **[Inferred]** a reasoned product/design hypothesis derived from the evidence.
- **[Uncertain]** unresolved because the current source or environment cannot answer it.

### Method and coverage

**[Observed]** The investigation included:

- mandatory repository instructions, constitution, governance, goal/state/campaign/known-issue/validation records;
- a top-level and source-area census;
- every current primary route and pushed route;
- the generated registry and all 42 `game.json` catalog entries;
- eight representative games spanning timed visual search, recall, reaction timing, structured math input, content matching, deduction, rule switching, and spatial transformation;
- shared shell, UI kit, theme, GameHost/GameResults, workout, rating, mastery, progression, rewards, streak, data portability, accessibility, QA, build, and CI paths;
- Git history through Campaigns 014–028 and earlier UI/gamification milestones;
- local typecheck, lint, full CI-mode Jest, validators, dependency audit, OpenSpec, Expo Doctor, external web export, QA self-tests, catalog listing, current-head Android AVD boot, and current-head QA all-mode attempt;
- Refero style/screen/flow research and official product/evidence sources.

**[Uncertain]** Current native rendered screens, touch ergonomics, first-launch behavior, small/large phone behavior, light/dark perception, and human comprehension could not be observed because the dedicated AVD did not register with ADB. Exact coverage is recorded in `RUNTIME_EVIDENCE.md`; no current screenshot is claimed.

Supporting evidence documents:

- [Current product audit](CURRENT_PRODUCT_AUDIT.md)
- [Surface inventory](SURFACE_INVENTORY.md)
- [Runtime and health evidence](RUNTIME_EVIDENCE.md)
- [Refero reference map](REFERO_REFERENCE_MAP.md)
- [Proposed information architecture](PROPOSED_INFORMATION_ARCHITECTURE.md)

## Verified current baseline

### Product and navigation

**[Verified in source]** The product is an Expo React Native + TypeScript application using Expo Router. The native/web tab model has four labeled destinations: Home, Games, Progress, Profile. Pushed routes cover game detail, game execution, results, four Progress detail modes, Rewards, Data Management, and Storage Unavailable. There is no dedicated onboarding route in the current source inventory.

**[Verified in source]** Root bootstrap initializes SQLite before ready render, registers the generated game catalog, seeds/synchronizes progression, resolves theme/settings, and provides audio/haptics/toast infrastructure. Database failure is a recoverable storage state; later bootstrap work is fail-open.

### Catalog and game foundation

**[Verified in source]** The current catalog contains 42 games across eight primary domains:

| Domain | Count |
|---|---:|
| Attention | 5 |
| Flexibility | 5 |
| Language | 5 |
| Logic & Problem Solving | 5 |
| Math | 5 |
| Memory | 7 |
| Spatial | 5 |
| Speed | 5 |

The registry is generated from `apps/mobile/src/games/*/game.json` and includes version metadata, descriptions, primary/secondary domains, tutorial availability, and lazy loaders. `language-word-match` is catalog-visible but is excluded from workout selection by a current explicit rule.

**[Verified in source]** All 42 entries declare tutorial support. Eight inspected representatives use distinct interaction patterns but share `GameHost`, lifecycle/timing/pause/results conventions, deterministic QA controls, and versioned generator/scoring metadata. This is a product differentiator worth protecting.

### Workout and evidence foundations

**[Verified in source]** The daily mix is a deterministic four-game workout balanced toward weaker or undertrained domains, with persisted progress and resume. Focus templates are generated for the eight categories. Short (2), Standard (4), and Extended (6) lengths exist; rerolls are free-first, coin-priced thereafter, capped at five per day. The engine records provenance and completion state.

**[Verified in source]** SQLite schema version 12 is canonical local persistence. Sessions, ratings, XP, currency ledger, workouts, tutorials, profile, quests, achievements, favorites, and portability repositories are versioned or transactional where required. The redesign must preserve those contracts.

### Existing visual and interaction foundation

**[Verified in source]** The current token system is called “Neon Arcade” in Campaign 026 comments. It uses a warm-paper light background, deep-plum dark background, vermillion accent, eight domain identities, semantic XP/streak/currency families, rounded geometry, tactile buttons, contrast tests, light/dark resolution, Reanimated/shared motion, audio/haptics providers, stable test IDs, and reusable Card/Button/ListRow/ScreenShell primitives.

The key question is not whether the token file is technically coherent; tests and source show that it is. The question is whether all its simultaneous signals help an adult player understand the next training action. **[Inferred]** The direction should retain warmth, high contrast, domain recognition, and tactile feedback while reducing simultaneous accent competition and “arcade” framing on utility surfaces.

## Health and contradiction baseline

### Current local checks

**[Verified by test/CI]** At the investigated SHA:

- Typecheck passed (`npm run typecheck -- --pretty false`).
- Lint passed (`npm run lint`).
- CI-mode Jest passed: 553 suites passed, 4 skipped; 6,548 tests passed, 5 skipped; 5 snapshots passed.
- Registry drift, provenance, offline, secret, task-ownership, affected-map, workflow hygiene, dependency audit, QA self-test, and OpenSpec checks passed.
- Web export passed to an external temp directory: 96 files and 20 static routes.
- Expo Doctor failed one of 21 checks because 14 SDK-57 packages are one patch behind expected versions. No dependency change is authorized in this campaign.

### Current runtime and CI

**[Verified by test/CI]** The dedicated headless `braintraining-qa36` AVD was created but failed to register with ADB on two configured boot attempts. The QA all-mode command exited 2 and recorded 44 targets as `NOT VALIDATED`, with zero fabricated passes or failures. Current-head runtime visual conclusions are therefore source-based hypotheses.

**[Verified by test/CI]** Four GitHub Actions workflows at the exact synchronized SHA failed within seconds with zero recorded job steps and no failure log: App CI run `35096980170`, Repository Integrity `35096980154`, Android Build Smoke `35096980266`, and iOS Build Smoke `35096980141`. The same immediate pattern appears at the preceding synced SHA. **[Inferred]** This suggests runner/account/dispatch infrastructure failure, but the API output cannot prove the root cause. It is not classified as a product failure and was not fixed here.

**[Historical]** Campaign 028 and the 2026-09-14 frontier-audit records show prior emulator-5560 runtime canaries, daily workout/relaunch checks, and visual/a11y evidence at earlier SHAs. Those records are valuable regression context only.

### Current contradictions that affect redesign trust

1. **[Verified]** A green local source/test baseline coexists with Expo patch drift and zero-step remote workflow failures. Product redesign decisions should not rely on a single “green” label.
2. **[Verified]** The app is genuinely offline-first in source/validators, but current native launch was not observed. Keep offline claims precise and test launch once the environment is repaired.
3. **[Verified]** Catalog breadth and workout eligibility differ for `language-word-match`. The distinction needs intentional product handling.
4. **[Verified]** Current docs call the visual direction Neon Arcade, while the actual palette is warm paper/plum/vermillion plus eight vivid domain colors. The redesign should evaluate perceived hierarchy, not simply rename or reskin.
5. **[Inferred]** History shows repeated successful waves adding polish and engagement systems. The next leverage point is composition and prioritization, not another repo-wide cosmetic wave.

## Root-cause diagnosis

### Ranked findings

| Rank | Category | Root cause | Current evidence | Product consequence |
|---:|---|---|---|---|
| 1 | IA / hierarchy | The daily training action shares first-class visual weight with configuration, streaks, balances, rewards, Spotlight, mastery, and history | Home source is approximately 1214 lines and includes all of those sections | A new or returning player must interpret the system before starting the basic job |
| 2 | Feature density | Each mature subsystem is rendered where it is available instead of being assigned one owner and disclosure level | Profile ~1397 lines; Progress ~1368 lines; Rewards/Data Management are separate yet previewed elsewhere | Valid features form a “dashboard of systems” and increase scroll/choice burden |
| 3 | Navigation semantics | The four tabs are stable, but their content jobs are broad and pushed routes are not consistently framed as a single journey | Current tab and route inventory | Players can reach many screens without a strong model of where a decision belongs |
| 4 | Discovery | Games combines featured hero, three shelves, search, eight filters, favorites, and 42 cards | `games.tsx`, `FeaturedHero`, `DiscoveryShelves`, `GameCard` | Recommendation, browsing, and lookup compete instead of becoming distinct modes |
| 5 | Progress comprehension | Rich analytics appear before a concise answer to consistency, recorded movement, and next focus | Progress overview includes activity, volume, PBs, comparisons, co-occurrence, mastery, and detail links | A motivated player can explore, but a casual player may see an analytics console |
| 6 | Gamification mental model | XP/level, coins, streak protection, quests, achievements, milestones, mastery, Spotlight, rerolls, rewards, and cosmetics each signal progress | Current progression/economy source and Profile/Rewards UI | Players can confuse “what to do,” “what I earned,” and “what I am improving at” |
| 7 | Game identity | Shared chrome is strong; most authored identity is carried by category/name/domain color | GameHost plus representative module inspection | Games risk reading as colored entries in a database rather than memorable exercises |
| 8 | Onboarding | No dedicated first-run route or tested first-session narrative is present | Route inventory; runtime blocked | **[Uncertain]** new users may receive mature returning-user density before understanding the premise |
| 9 | Visual expression | “Neon Arcade” may over-express engagement on surfaces whose job is calm explanation | Token comments and palette; no current screenshot | More color/motion can further compete with the task rather than solve hierarchy |
| 10 | Validation gap | Current-head native perception and human comprehension are not observed in this campaign | AVD/QA block | Later implementation must treat usability validation as a gate, not a polish task |

### Symptoms versus causes

- “Too many cards” is a symptom. The cause is many systems being allowed to be primary at the same time.
- “The UI looks busy” is a symptom. The cause is competing semantic colors, repeated metrics, and multiple recommendation/claim surfaces.
- “Progress is overwhelming” is a symptom. The cause is analytics depth being rendered before the user asks a question.
- “Games feels like a catalog” is a symptom. The cause is game identity and discovery rationale being weaker than the database structure.
- “Gamification feels confusing” is a symptom. The cause is several persistence-backed loops being narrated as equal motivations.
- “The redesign needs more visual polish” is an incomplete diagnosis. The first intervention should be hierarchy, copy, ownership, and journey sequencing; visual styling follows.

## Strengths to preserve

1. **[Verified in source]** Offline-first local ownership, SQLite canonical state, backup/restore, and explicit data safety.
2. **[Verified in source]** 42 games with materially different mechanics, versioned generators/scoring, and shared SDK contracts.
3. **[Verified in source]** Deterministic daily/focus workouts, personalization reasons, reroll accounting, provenance, resume, and completion.
4. **[Verified in source]** GameHost/GameResults, tutorial persistence, pause/timer semantics, error boundaries, and dev-only QA hooks.
5. **[Verified by test/CI]** Broad deterministic test/validator coverage and honest blocked/not-validated reporting.
6. **[Verified in source]** Tokenized themes, contrast checks, stable semantic IDs, and shared UI primitives.
7. **[Verified in source]** Rich analytics that can support useful personal-performance feedback when progressively disclosed.
8. **[Historical]** Campaign 014–028 history shows careful work on correctness, accessibility, visual consistency, and release gates; the redesign should deepen these seams instead of replacing them.

## Target product definition

### North star

> **Open, understand today’s focused training in seconds, complete it without navigating a system maze, and leave with a trustworthy personal-performance insight plus an obvious next step.**

This formulation is supported by the current workout/game foundation and by Refero patterns showing selected-plan clarity, focused task content, one forward action, and bounded completion. **[Inferred]** “Seconds” and “trustworthy” are product targets, not current measurements.

### Target audience assumptions

These are hypotheses to validate, not claims about current users:

- Adults who want a repeatable short cognitive-game routine without a clinical or competitive identity.
- Returning players who value consistency and personal records but do not want to manage several progression systems before playing.
- Curious players who want to choose a specific kind of challenge after the default routine is understood.
- Privacy/offline-conscious players who value local data ownership and may not want account setup.
- Power users who want deep domain/game history if it is available behind a clear summary.

### Anti-goals

The product should not become:

- a generic arcade where visual excitement replaces a clear training purpose;
- a clinical, diagnostic, medical, neurological, intelligence, or age-reversal dashboard;
- an RPG economy wrapped around mini-games, with coins and claims competing with the exercise;
- a random puzzle collection with no coherent daily path or evidence model;
- an analytics console that requires chart literacy to know what to do next;
- a direct Elevate, Lumosity, Brilliant, Quizlet, Promova, or Duolingo clone;
- a network/account gate around the offline core;
- a forced reminder or streak obligation before a player has completed a first session.

### Safe product language

Use precise statements such as “your recorded score is above your recent average,” “you have trained 3 days this week,” “you have a personal best,” or “this domain has not been played recently.” Do not state or imply that a score proves intelligence, health, diagnosis, neurological improvement, workplace performance, or protection from impairment. The [FTC Lumosity settlement](https://www.ftc.gov/news-events/news/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges-its-brain-training-program) is an evidence boundary, not a competitor-style reference.

## Proposed information architecture

The full ownership map is in [PROPOSED_INFORMATION_ARCHITECTURE.md](PROPOSED_INFORMATION_ARCHITECTURE.md). The decision is summarized here so the master plan is self-contained.

### Four tabs

| Tab | Primary job | Above-fold rule | Secondary/deep content |
|---|---|---|---|
| Home | Start or resume Today’s Workout | One hero, one Start/Continue, x/4, current/next leg | Choose a workout, reroll, streak context, Spotlight, recent training, completion links |
| Games | Explore or deliberately choose a game | One suggested/continue row, search utility, browse control, compact first content row | Category/all games, favorites, game detail, deeper recommendation rationale |
| Progress | Understand consistency and recorded-performance movement | Window, consistency answer, 2–3 summary metrics, one interpretation, domain/next-focus card | Activity, domain/game detail, full history, rolling/comparison/co-occurrence analysis |
| Profile | Manage local identity, motivation, preferences, and trust | Local player/level plus grouped Motivation, Rewards, Settings, Data rows | Streak protection, quests, achievements, cosmetics, theme/sensory, export/restore/delete |

### Ownership resolution

- Workout creation, resume, reroll, and completion belong to Home/Today.
- Game discovery and deliberate choice belong to Games; Game Detail owns the Play decision and evidence summary.
- Mastery belongs beside the game/domain evidence, not as a competing Home progression track.
- Rewards owns claimable inbox, claim-all, cosmetics, and reward history. Profile shows a pending count/preview only.
- Streak is compact context on Home and detailed Motivation content in Profile; Progress owns consistency evidence, not protection sales.
- Quests, achievements, and streak milestones share a Motivation hierarchy and one claim vocabulary.
- Data Management is Profile → Data, never a daily-surface card.
- Daily Spotlight may occupy one optional suggestion slot, never a third primary reason to play.

### State rules

Every top-level destination needs explicit loading, empty, error, and offline states. Empty history should invite the first workout, not display blank charts. Errors should not silently become zeros. Offline core browsing, playing, results, and local Progress remain available; optional network capabilities must be labeled and must not block the core.

## Golden-path redesign specification

The golden path is the highest-priority later implementation. It is specified at wireframe/content level, not as production pseudo-code.

### Step 0 — launch

- **Objective:** arrive at a trustworthy Today surface.
- **Hierarchy:** brief ready/loading state, then Today’s Workout; no dashboard flash of every system.
- **Primary action:** none during bootstrap; once ready, Start/Continue.
- **Visible progress:** if an existing workout is in progress, show its x/4 state immediately.
- **Back/interruption:** system back exits Home normally; no modal on launch.
- **Error/resume:** database failure uses Storage Unavailable with Retry; persisted workout resumes from local state.
- **Copy:** explain local/offline state only when useful; avoid technical bootstrap language.
- **Motion/sensory:** brief, quiet entrance; do not delay CTA for animation; honor audio/haptic settings.
- **Accessibility:** screen-reader order begins with heading, workout status, CTA; loading/error states have live announcements and a reachable Retry.
- **Reuse/redesign:** reuse root bootstrap, ScreenShell, settings/theme, SQLite, and workout hooks; redesign content order and loading treatment only later.

### Step 1 — Home / understand Today

- **Objective:** know what the next useful action is without learning the entire product.
- **Hierarchy:** greeting/status → Today’s Workout → plain length/reason → x/4 → current/next leg → Start/Continue.
- **Primary action:** `Start workout` or `Continue workout`.
- **Secondary actions:** `Choose a workout` and a quiet `Why this workout?`; no primary reroll or rewards action.
- **Visible progress:** four-leg sequence with Done / Now / Up next; if complete, show completion state.
- **Back/interruption:** not applicable to the idle Home state; preserve the current workout if navigating away.
- **Error/resume:** missing/invalid instance recovers through existing workout logic; avoid presenting an empty plan as a finished plan.
- **Copy:** “Today’s Workout,” “4 games,” “Start where you left off,” and one short evidence-based reason. Avoid medical benefits.
- **Motion/sensory:** restrained entrance stagger; a single progress transition when a leg completes; haptic confirmation on Start only if enabled.
- **Accessibility:** CTA has an explicit action label; leg states are spoken as status; minimum 44 dp targets; color never carries Done/Now alone.
- **Reuse/redesign:** reuse personalizedWorkout/use-workout, metadata, `home-workout-cta`, progress components, and persistence; structurally regroup lower sections.

### Step 2 — start or resume workout

- **Objective:** commit to the default plan with confidence.
- **Hierarchy:** selected plan and duration → what happens next → Start/Continue.
- **Primary action:** enter the first unfinished game intro.
- **Secondary actions:** change plan/length or go back; reroll is available in configuration, not as the equal default.
- **Visible progress:** `Game 1 of 4` before entry and `0/4` plan context.
- **Back/interruption:** back returns to Home/configuration without losing the persisted plan.
- **Error/resume:** route/load failure returns to a recoverable workout context; existing instance remains inspectable.
- **Copy:** explain the plan in one line; show “why” only on expansion.
- **Motion/sensory:** one deliberate transition from plan to game intro; no reward animation before play.
- **Accessibility:** announce selected length and game count; focus lands on Start/Continue.
- **Reuse/redesign:** reuse workout instance/provenance/navigation logic; redesign the configuration hierarchy and action naming.

### Step 3 — game intro and tutorial

- **Objective:** understand the mechanic and be ready to act.
- **Hierarchy:** game identity/interaction verb → one rule sentence → one visual/example if needed → difficulty/time context → Start.
- **Primary action:** `Start game` (or `Continue tutorial` on first use).
- **Secondary actions:** `How to play`, Back, and an explicit skip only when safe and understandable.
- **Visible progress:** game position in workout, e.g. `1 of 4`; tutorial step count if multi-step.
- **Back/interruption:** Back returns to workout context; no session row should be written before a legitimate start.
- **Error/resume:** lazy chunk/error boundary states explain retry/return; tutorial hydration failure must not silently claim completion.
- **Copy:** describe the player action, not a cognitive benefit: “Find the one item that is different.”
- **Motion/sensory:** a short prepare transition is allowed; tutorial animation must be pause-safe and not essential to understanding; audio/haptics are optional reinforcement.
- **Accessibility:** examples have semantic labels; instructions are readable with text scaling; all actions have stable IDs and screen-reader roles.
- **Reuse/redesign:** reuse GameHost, tutorial store, registry metadata, and test contracts; standardize intro content hierarchy while preserving per-game mechanic copy.

### Step 4 — gameplay

- **Objective:** focus on the current task with minimal chrome.
- **Hierarchy:** task board/input → essential timer/round progress → one pause affordance; score is secondary unless mechanic requires it.
- **Primary action:** the game-specific interaction; no navigation competing with the board.
- **Secondary action:** Pause.
- **Visible progress:** round/time/step state appropriate to the mechanic; do not display every reward/economy metric.
- **Back/interruption:** system back opens the same pause decision as the visible Pause action; timers freeze through the shared lifecycle.
- **Error/resume:** recoverable state keeps the current session; app background/relaunch behavior must use existing persistence semantics.
- **Copy:** only immediate instruction/feedback; defer records/rewards to results.
- **Motion/sensory:** use motion to show state change, haptics/audio for correct/incorrect/finish only when enabled; avoid decorative loops that compete with timed play.
- **Accessibility:** legitimate interaction candidates have semantic IDs/labels; timing-sensitive games have testable states and non-color feedback; reduced-motion/large-text behavior must be checked.
- **Reuse/redesign:** preserve every game reducer/generator/scoring module and GameHost lifecycle; redesign only shared HUD/instruction framing unless a human test identifies a game-specific blocker.

### Step 5 — per-game result

- **Objective:** understand what happened and know whether to continue.
- **Hierarchy:** completion headline → one or two plain performance facts → immediate reward → next action.
- **Primary action:** `Next game` when in a workout; `Finish workout` on the final leg; outside a workout, `Play again` or `Done` based on context.
- **Secondary actions:** details/history, Browse Games, or Done.
- **Visible progress:** `Game 1 of 4 complete`, next game name, or workout-complete state.
- **Back/interruption:** Back returns to the workout/result context without duplicating session persistence; no repeated claim on revisit.
- **Error/resume:** persistence status is surfaced; a failed write cannot be presented as saved success; retry remains reachable.
- **Copy:** “Your score,” “Personal best,” “Above your recent average,” “+XP,” and exact numbers. Do not say “your brain improved.”
- **Motion/sensory:** one bounded completion/reward cue; no confetti on every minor metric; respect reduced motion and sound/haptic settings.
- **Accessibility:** result headline and primary CTA are first in reading order; stats have label/value pairs; no reliance on color for PB or performance band.
- **Reuse/redesign:** reuse GameResults, ledger/XP/rating writes, workout actions, and idempotency; reduce competing result sections and clarify the primary action.

### Step 6 — next game transition

- **Objective:** continue without reorientation or accidental restart.
- **Hierarchy:** next game name/position → one sentence of preparation → Continue.
- **Primary action:** enter the next GameHost intro.
- **Secondary action:** leave workout safely; no library detour required.
- **Visible progress:** update x/4 immediately and retain the completed leg state.
- **Back/interruption:** Back from the next intro returns to the result/workout context; active session has not started.
- **Error/resume:** a lazy-load failure can retry or return to the saved workout; the completed prior session remains exactly once.
- **Copy:** “Next: [game]” and one mechanic verb; no second reward pitch.
- **Motion/sensory:** short crossfade/slide tied to progression; no long blocking transition.
- **Accessibility:** announce next position and game title; focus lands on the next action.
- **Reuse/redesign:** reuse workout navigation/provenance and registry lazy loaders; redesign transition copy and result-to-intro handoff.

### Step 7 — workout completion

- **Objective:** feel finished, understand the session record, and choose a sensible follow-up.
- **Hierarchy:** “Workout complete” → four-leg completion/total → one or two personal-performance highlights → primary next action.
- **Primary action:** `See today’s progress` or a contextually recommended next action; `Done` returns Home. Exactly one is primary per state.
- **Secondary actions:** Browse games, Rewards, history.
- **Visible progress:** 4/4 and a compact summary; no need to replay every card.
- **Back/interruption:** Back returns to Home completion state; revisiting does not re-award rewards.
- **Error/resume:** completion reconciliation uses existing persisted instance; failure is explicit and recoverable.
- **Copy:** “Workout complete,” “You trained 4 games,” “Your strongest recorded result today was…,” not a global cognitive claim.
- **Motion/sensory:** one completion celebration with a quiet mode; no stacked streak/XP/quest/achievement/cosmetic animation cascade.
- **Accessibility:** completion announced as a state change; summary grouped; primary/secondary actions distinguishable by labels and order.
- **Reuse/redesign:** reuse workout summary, reward idempotency, home refresh, and celebration host; consolidate exits and reward narration.

## Games redesign specification

### Intentional discovery model

Games should support a player who says either “tell me what to play” or “I want that specific game.” Make those modes visually distinct:

1. **Suggested next / Continue training:** one or two choices with a short reason from existing evidence (weak/stale/near-PB/novelty), not a generic superlative.
2. **Browse all games:** search, eight domain categories, favorites, and the full 42-game catalog.

The existing three shelves — Recommended for today, Near a personal best, Getting rusty — are valuable signals but should be combined into one primary suggestion area with a deeper rationale/filter view. This is a presentation simplification; it does not require deleting the recommendation engine.

### Catalog structure

Keep the current eight primary categories and generated registry. Do not invent a new taxonomy until human research demonstrates that the current domains are not understandable. Category controls should use plain names and counts; secondary domains can inform recommendations and Progress but should not create additional top-level filters.

`language-word-match` remains visible in the catalog under its current source rule. **[Inferred]** The product should either explain “not in Today’s Workout” in a secondary detail state or avoid exposing that implementation distinction unless it affects a player’s expectation. It must not appear as a broken daily recommendation.

### Game identity strategy

Every game should have an authored signature built from its real interaction verb, while remaining inside the global system:

- Odd One Out: spot / isolate / visual outlier.
- Grid Recall: reveal / remember / reconstruct.
- Reaction Time: signal / wait / respond.
- Equation Builder: assemble / prove / balance.
- Word Match: connect / meaning / association.
- Rule Grid: investigate / constrain / deduce.
- Card Sort: switch / adapt / reframe.
- Transform Match: rotate / transform / compare.

Use a compact icon or illustration, one sentence of mechanic copy, a restrained transition motif, and optional sound/haptic identity. Category color remains a taxonomy cue. Do not create eight unrelated brands, clinical benefit badges, or a visual spectacle that delays Play.

### Game Detail

First viewport: category/interaction motif, game name, one mechanic sentence, tutorial note, mastery/record summary, and `Play`. Below: sessions/best/average, trend, recent sessions, next mastery milestone, and technical/version metadata only where it helps trust or support. A player should not need to read analytics before deciding to start.

### Games states and acceptance direction

- New player: one suggested game + Browse all games.
- Search/filter: recommendation content compresses; query and result count are prominent.
- No results: explain the active filter and provide Reset/Browse actions.
- Favorites empty: teach the favorite action and offer the full catalog.
- Offline: browse/play/detail remain local.
- Lazy-load/error: retry or return without substituting a different game.
- Large catalog: scroll performance and semantic order must remain stable; cards do not all need identical metadata density.

## Progress redesign specification

Progress should be an answer-first evidence view, not a deletion of the analytics engine.

### Overview level

At the selected window (7d/30d/90d/all), the first viewport should answer:

1. **Consistency:** number of trained days/sessions and a compact activity signal.
2. **Recorded movement:** a carefully worded recent-versus-prior or PB/trend statement based on stored game evidence.
3. **Next consideration:** one domain/game suggestion based on freshness, balance, or evidence, with a plain reason.

Recommended structure: window selector → consistency headline → 2–3 summary metrics → one chart paired with “This shows…” → domain cards/list → deeper links. The composite rating can remain as a product-specific score, but its provenance must be explained and it must not be styled as a cognitive-health index.

### Progressive disclosure map

| Level | User question | Existing analytics to map here |
|---|---|---|
| 1. Overview | Am I training consistently; what is changing; what next? | Activity summary, recent sessions, PB callout, domain summary, one recommendation, workout completion |
| 2. Domain detail | What does one domain’s recorded evidence show? | `progress-domain`: rating/freshness/movement/best/history/trend/accuracy/reaction/difficulty/activity/games/recent |
| 3. Game detail | What is the history of one game? | `game-detail/[id]` plus `progress-game`: records, PB, trend, rolling average, score/difficulty/recent history |
| 4. Advanced history | How does the long record behave? | Activity calendar, full history, PB history, comparisons, co-occurrence/breadth, detailed charts |

The duplicate-looking Game Detail/Progress Game routes need a later ownership decision: merge their evidence sections or give the latter a clearly named “Game history” role. Do not discard the underlying queries solely to simplify the first viewport.

### Data and claim rules

- Use “recorded performance,” “recent average,” “personal best,” “trained,” and “not played recently.”
- Include sample/window context where a trend could be overread.
- Keep current no-causation/co-occurrence disclaimers and make them readable.
- Never infer medical, intelligence, neurological, age, or real-world performance outcomes from scores.
- Do not show sparse data as authoritative; distinguish “not enough sessions” from “no change.”

## Profile, settings, rewards, and trust surfaces

Profile should be a grouped control center, not a vertical inventory of every module.

1. **Local player:** quiet identity and level summary.
2. **Motivation:** streak status/protection, active quests, achievements, milestones.
3. **Rewards:** pending claim count and entry to the single Rewards owner; small equipped preview.
4. **Settings:** theme, SFX, haptics, accessibility preferences.
5. **Data:** export, backups, merge/replace restore, delete-all safeguards.

Rewards keeps its existing claim-all/idempotent behavior and cosmetic slots, but Profile should not duplicate the full collection/store. Data Management keeps local counts, export/share, backup, restore, and typed DELETE wipe; its safe warnings are a product strength. Destructive actions should use explicit consequence confirmation; normal Start should never feel like a commitment modal.

If onboarding is validated as necessary, use a three-step optional path: explain the offline training premise, choose time/focus or skip, then enter the existing tutorial/game. No account, health questionnaire, or permission gate before first play.

## Gamification and progression recommendation

### Mental-model hierarchy

The interface should communicate the following order:

1. **Behavior:** complete Today’s Workout or choose a game.
2. **Immediate feedback:** what happened in this round, including personal evidence and a bounded reward.
3. **Consistency:** a compact streak/training-days signal.
4. **Capability evidence:** mastery/domain/game records and next milestone.
5. **Optional motivation:** quests, achievements, cosmetics, Spotlight.
6. **Economy mechanics:** coins, rerolls, Freeze/Shield/Recovery only at their decision points.

### Simplification table

| System | Recommendation | What changes in the primary UI | What remains protected |
|---|---|---|---|
| Daily workout | **Keep / elevate** | One Home hero and one next action | Deterministic selection, provenance, lengths, resume, completion |
| Workout focus/length | **Keep / consolidate** | One Choose a workout route; default remains instant | Template IDs, deterministic seeds, persisted instances |
| Rerolls | **Keep / demote** | Secondary in configuration; exact cost at decision point | Cap, ledger debit, idempotency, error states |
| Streak | **Keep / simplify** | Compact Home rhythm; detailed Motivation section | Reconstruction, protection semantics, milestone rewards |
| XP/level | **Keep / quiet** | Result/Profile status, not a Home hero metric | XP awards and level calculations |
| Coins | **Keep / contextual** | Display only when a purchase/reroll/protection decision needs it | Append-only ledger and balance integrity |
| Mastery | **Keep / make explanatory** | Game/Progress evidence with one next milestone | Versioned tier calculation from sessions |
| Quests | **Keep / consolidate** | One Motivation/Rewards summary, not a Profile wall | Period selection, criteria, idempotent claim |
| Achievements | **Keep / retrospective** | Below the fold in Motivation/Rewards | Definitions, unlock and claim correctness |
| Streak milestones | **Keep / consolidate** | One milestone list alongside Motivation | Existing days/rewards and claim state |
| Rewards inbox | **Keep / single owner** | Rewards route owns claim-all/history | Idempotent cross-system collection |
| Cosmetics | **Keep / optional** | Rewards/Profile customization only | Three slots, ownership/equip rules |
| Daily Spotlight | **Keep / one slot** | Optional suggestion after Today or in Games | Deterministic date/game/difficulty rotation |
| Achievement/quest/cosmetic previews | **Remove from competing first viewport** | Replace multiple cards with one pending/next-reward summary | Underlying data and routes |
| Parallel reward currencies/labels | **Question / validate** | Do not add another currency or expose all balances everywhere | Current currency semantics until a later product decision |

“Remove” here means remove from the primary narrative or duplicate surface. It does not authorize deleting persistence or changing the economy in Campaign 029. A later product decision may retire a system only after migration/backup/economy analysis.

## Visual and interaction direction (after IA)

### Direction: calmly kinetic training desk

The proposed visual direction is a warm, adult training environment with moments of kinetic energy when the player acts. It should feel premium and lively without making every screen an arcade cabinet.

This direction synthesizes the current engine with Refero evidence: Headspace’s warm modern playfulness, Todoist’s single-accent organized desk, Perplexity’s parchment-like authority, Duolingo’s next-action/completion clarity, Brilliant’s focused problem content, and the Dropset/Train Fitness patterns for explicit active state and chart context. Full traceability is in [REFERO_REFERENCE_MAP.md](REFERO_REFERENCE_MAP.md).

### Current token decisions

| Area | Retain | Restrain / change later |
|---|---|---|
| Color | Warm paper light, deep plum dark, vermillion action, semantic contrast families, domain recognition | Do not use all eight domain colors as simultaneous decoration; reserve accent color for action/selection and domain color for taxonomy/evidence |
| Neutral strategy | Surface/background distinction, flat/faint elevation, contrast-tested text | Let neutral space separate sections; avoid stacking tinted cards for every subsystem |
| Light/dark | Separate readable palettes with live system/user resolution | Test semantic equivalence and glare/fatigue on device; dark mode should not become a different product |
| Typography | Existing hierarchy, tabular numerals for stats, readable scaling | Reduce competing display treatments; use large type for the current task/result, not every card title |
| Spacing | Tokenized rhythm, centered max width, safe-area/inset handling | Increase purposeful whitespace around the one CTA; shorten repeated card padding where content is secondary |
| Corners/shapes | Rounded family and tactile button lip | Use fewer hero shapes and avoid pill-everything controls; shape should signal control type |
| Elevation/borders | Existing flat/card/raised/overlay roles | Keep shadows subtle; avoid heavy or chromatic elevation |
| Buttons | Shared Button variants, 44 dp minimum, physical-lip affordance | One primary per state; secondary/ghost actions must not compete with Start/Next |
| Cards | Shared Card variants and semantic tones | Cards become containers for grouped decisions, not default wrappers for every paragraph |
| Iconography | Existing platform symbols/test IDs | Add authored game motifs with a small consistent stroke/shape family; avoid decorative icon noise |
| Illustration | Contained, purposeful game identity art | No full-bleed hero art that pushes the task below the fold; do not copy competitor mascots |
| Data visualization | Existing domain colors and chart infrastructure | Pair every chart with interpretation, context, sample/window, and accessible labels |
| Motion | Existing Reanimated/motion tokens, lifecycle-safe transitions | Use motion for state/feedback/orientation; do not animate every card entrance or gate the CTA |
| Haptics/audio | Existing providers and settings | Use as optional semantic punctuation for correct/finish/pause; respect reduced sensory preference and platform state |
| Celebration | Existing reward host and bounded effects | One coherent completion moment; do not cascade XP, streak, quest, achievement, and cosmetic overlays |

### Game-specific art direction

Use a common “training desk” frame with individual exercise motifs: scan, recall, react, build, connect, deduce, switch, transform. A future design kit should define icon/illustration slots, motion verbs, and optional sound cues rather than a separate art system per game. This gives the 42-game catalog memory and character without making category color carry all identity.

### Accessibility and performance principles

- Maintain the existing 44 dp minimum touch target, semantic test IDs, label visibility, text scaling, contrast tests, and color-independent state communication.
- Keep task instructions and result headlines first in accessibility order; do not bury Start/Next below decorative content.
- Ensure timers/game states expose readable status where the mechanic allows it; do not turn timing into an inaccessible color-only signal.
- Respect system/user theme, reduced motion, sound/haptic toggles, safe areas, and screen-reader focus.
- Preserve lazy loading and error boundaries; measure perceived route load and avoid animation that blocks play.
- Keep chart summaries available as text and state sample size/window.
- Use current QA semantic IDs and deterministic force-win/timeout paths; dangerous QA controls remain dev-only.

## Refero-derived design principles

1. **Selected plan before catalog:** The Body Coach and Alive show a chosen plan, status, duration/type, and one start action. Apply to Home and workout configuration.
2. **One action accent:** Todoist and Perplexity show restraint around action/selection. Apply to Home/Progress so domain and reward colors do not all read as CTAs.
3. **Focused current task:** Brilliant lessons and Dropset active states make the current problem/timer dominant. Apply to GameHost intro/tutorial/gameplay.
4. **Explicit interruption:** Dropset persistent pause/stop and the Opal confirmation pattern support safe interruption. Apply to pause/quit and destructive data actions, selectively.
5. **Reward then continue:** Duolingo completion shows compact reward/evidence and one Continue. Apply to per-game result and workout completion.
6. **Chart plus meaning:** Train Fitness pairs a chart with workout/source context. Apply to Progress overview and domain detail.
7. **Optional, progressive onboarding:** BoldVoice/Imprint/Brilliant show visible intent progress and optional schedule/upsell paths. Apply only if first-run research confirms need; no account or permission gate.
8. **Warm adult character without copying:** Headspace’s warmth and the Refero cautions support contained illustration, friendly copy, and generous spacing rather than mascot or neon imitation.

## External product and evidence implications

**[Observed from official sources]** Elevate and Lumosity establish that broad catalogs, short daily sessions, personalization, and category framing are familiar product structures. Brilliant emphasizes interactive problems, immediate feedback, paths, and streak/progress; Quizlet emphasizes focused adaptive practice; Promova emphasizes goals/time and “what next.” These sources support structure hypotheses, not claims that Brain Training should copy their mechanics.

**[Observed from official source]** The FTC’s Lumosity settlement is a hard copy boundary. Brain Training should describe its own stored records and training behavior precisely. The product must not make unsupported medical, neurological, intelligence, age-reversal, or broad real-world cognitive claims.

**[Observed from official source]** Duolingo reports an internal streak experiment with retention/DAU changes after separating streak and daily-goal framing. Treat this as a company-reported historical hypothesis; measure Brain Training’s own completion, return, and user sentiment rather than importing the result.

## Codebase-aware implementation impact map

This table is a roadmap for a later campaign, not a list of changes made now.

| Later phase | Likely source surfaces | Protected dependencies / integration seam | Required validation |
|---|---|---|---|
| P0 — concept/instrumentation | `src/app` route tests, QA semantic IDs, screen copy contracts, `docs/redesign` follow-up | No route or SDK rewrite before runtime/human evidence; define event vocabulary without collecting unsupported health data | Working AVD, current screenshots, task timing, a11y hierarchy, baseline metrics |
| P1 — golden path | `src/app/(tabs)/index.tsx`, `src/components/shell`, workout hooks/metadata, `game/[id]`, `game-detail/[id]`, `components/game-host`, `results`, shared Button/Card | `src/workout`, `src/db`, registry, GameHost/GameResults, session identity, reward/XP/rating idempotency | Typecheck/lint; focused route tests; daily workout, resume, one-game canaries, persistence/relaunch, a11y, light/dark |
| P2 — Games discovery | `(tabs)/games.tsx`, discovery components, GameCard, `game-detail/[id]`, registry/generated loaders | `game.json`/generated registry determinism, favorites, mastery, personalization snapshot, lazy chunks | Catalog/registry/provenance; search/filter/favorite/detail; representative mechanic entry; small viewport scroll/perf |
| P3 — Progress disclosure | `(tabs)/progress.tsx`, four Progress detail routes, analytics/progress components | Analytics query correctness, rating/mastery semantics, no-causation copy, time-window state | Full test suite or affected analytics canaries; seeded local evidence; chart labels; sparse/error/offline states; human comprehension |
| P4 — Profile/rewards simplification | `profile.tsx`, `rewards.tsx`, `data-management.tsx`, streak/quests/achievements/cosmetics components | Ledger/claim idempotency, backup/restore, settings persistence, dangerous-action gates | Progression/economy/portability tests; claim-all/relaunch; typed DELETE; a11y reachability; human findability |
| P5 — visual/game identity | `theme/tokens.ts`, UI kit, game identity slots, motion/audio/haptics providers | Contrast contracts, platform tabs, all GameHost games, generated assets/registry rules | Full theme/contrast; visual regression; eight mechanic families; performance and reduced-sensory checks |

### Shared hotspots to protect

Do not let parallel work independently edit `package.json`/lockfile, generated registry, navigation/tab definitions, SQLite schema/migrations, Game SDK contracts, global tokens, or workflow configuration. A later orchestrator should assign ownership packets and converge shared edits centrally, consistent with repository governance.

## Phased implementation roadmap for a future campaign

### Phase 0 — repair evidence and freeze decisions

**Goal:** obtain current native/runtime and human baselines before changing hierarchy.

- Repair or replace the dedicated AVD/runner environment without altering product behavior.
- Capture current Home, Games, Game Detail, intro/tutorial, representative gameplay, pause, result, completion, Progress, Profile, Rewards, Data, light/dark, and empty/error states.
- Run the existing QA all/canary/workout/resume modes at the exact baseline SHA.
- Conduct five-minute first-launch and returning-user tasks with no explanation.
- Confirm whether a dedicated onboarding path is needed and whether the current four labels are understood.

**Exit:** current screenshots/action traces, runtime pass/block reasons, and human baseline metrics exist; no redesign code yet.

### Phase 1 — golden path structural pass

**Goal:** make Today → Play → Result → Next → Complete coherent using current engines.

- Recompose Home above fold around Today’s Workout.
- Move configuration/reroll into one deliberate secondary flow.
- Simplify GameHost intro/tutorial/HUD/result hierarchy.
- Make one result action context-dependent and primary.
- Preserve workout persistence, provenance, pause, resume, and reward writes.

**Exit:** first-time and returning users can start/continue a standard workout, finish representative games, resume/quit safely, and understand completion in moderated and automated checks.

### Phase 2 — Games discovery and game identity

**Goal:** turn the 42-game catalog into an intentional discovery experience.

- Establish Suggested Next versus Browse All modes.
- Reduce concurrent recommendation shelves.
- Add authored interaction motifs within existing registry/card/detail seams.
- Preserve search/categories/favorites and generated catalog truth.

**Exit:** known-game lookup, exploratory browse, and recommendation tasks are fast and comprehensible; no category/game is lost.

### Phase 3 — Progress summary and disclosure

**Goal:** answer consistency, recorded movement, and next focus before chart depth.

- Recompose overview; retain analytics routes/queries.
- Resolve Game Detail versus Progress Game ownership.
- Make sparse-data, sample/window, no-causation, and offline states explicit.

**Exit:** participants can answer the three Progress questions and reach domain/game detail without being coached through every chart.

### Phase 4 — Motivation, rewards, and Profile grouping

**Goal:** reduce parallel gamification without losing trust or persistence.

- Group Profile into Motivation, Rewards, Settings, and Data.
- Make Rewards the sole claim/cosmetic owner.
- Compress streak/quest/achievement/milestone previews and contextualize economy.
- Validate the emotional effect of de-emphasizing coins/rerolls rather than assuming it.

**Exit:** players can find a pending reward, understand a streak protection choice, change sensory settings, and export/restore/delete safely.

### Phase 5 — visual and motion refinement

**Goal:** apply the calmly kinetic training-desk language after structure works.

- Tune tokens, typography, spacing, surfaces, authored game motifs, chart presentation, motion, audio, haptics, and celebrations.
- Validate light/dark, large text, reduced motion, small viewport, and performance.

**Exit:** visual changes improve hierarchy and perceived quality without introducing contrast, reachability, or game-lifecycle regressions.

## Human usability validation plan

No usability results are invented in this campaign. The plan below defines how to obtain them.

### Study sequence

1. **Baseline observation:** five to eight Android participants, mix of new and returning local-profile users; current build, no coaching, task completion and confusion recorded.
2. **Concept/prototype comparison:** test the proposed IA and golden path before broad visual implementation; compare against baseline on the same tasks.
3. **Implementation validation:** repeat at each phase exit with real persisted data and automation traces.
4. **Accessibility pass:** TalkBack/screen-reader users or accessibility specialists plus large text/reduced motion/sensory settings.

### Core tasks

- **Journey A:** open the app, explain what to do today, start/continue, complete one game, pause/resume, continue, finish the workout, and say what happened.
- **Journey B:** find a specific game, filter to a category, favorite it, read its detail, play it, and return without losing context.
- **Journey C:** use Progress to answer how consistently the person trained, what recorded performance changed, and what to consider next.
- **Journey D:** choose a focus workout/length, understand why it was suggested, reroll once, and resume it later.
- **Journey E:** first-launch user decides whether to start without an account; after completion, find a reward, change haptics/theme, and locate export.

### Measures and hypotheses

| Measure | Hypothesis / target to test |
|---|---|
| Time to first intentional Start | Today hierarchy should reduce hesitation versus current baseline |
| Correct first tap on Home | One dominant CTA should beat competing-card selection |
| Workout completion rate / drop-off step | Result → Next and completion should reduce mid-workout navigation loss |
| Pause/resume confidence | Users can explain what is retained and return to exact state |
| Result comprehension | Users can state score/PB/recent comparison and next action without medical interpretation |
| Games choice latency | Suggested versus Browse modes reduce scanning/search confusion |
| Progress answer accuracy | Users answer the three overview questions without opening every chart |
| Reward/streak findability | Grouped Profile/Rewards ownership is more discoverable than the current long stack |
| Accessibility task success | TalkBack/large text/reduced motion preserve action order and state meaning |
| Subjective burden | Fewer simultaneous systems feel calmer without making the product bland or less motivating |

Use confidence intervals or qualitative synthesis appropriate to sample size; do not call a small formative study proof of retention or cognitive benefit. Instrument only product behavior and experience, not unsupported health outcomes.

### Exit criteria for human validation

Before a later phase is accepted, participants should be able to complete its core task with no critical confusion, no data-loss fear, no inaccessible primary action, and no unsupported product claim. Any remaining medium/low confusion should be recorded with a follow-up owner and hypothesis.

## Risks and unresolved questions

| Risk/question | Why it matters | Required resolution |
|---|---|---|
| Current native runtime unavailable | Source cannot prove visual hierarchy, touch ergonomics, or first-launch behavior | Restore AVD/physical device and repeat the runtime matrix |
| GitHub zero-step failures | Build/CI status cannot be used as a current release gate | Inspect runner/account logs when available; do not infer app failure from current API result |
| Expo patch drift | Future implementation may need a dependency refresh that is outside redesign scope | Separate dependency campaign/ADR; do not mix with IA work |
| Onboarding absence | New-user comprehension is unobserved | Baseline clean install and test optional three-step concept |
| Four-tab contract | Renaming may break constitution/routes/tests without solving hierarchy | Preserve labels initially; validate content ownership first |
| `language-word-match` workout exclusion | Catalog/workout expectations can diverge | Decide whether to explain or quietly scope the rule in UI after testing |
| Economy/streak pressure | Demotion may improve calm or reduce motivation | Test current versus grouped/quiet treatment; protect ledger semantics |
| Game identity effort | Art/motion can become a new surface-density problem | Define a small motif contract and test eight representative families |
| Progress claims | Trend language can overpromise from sparse data | Require sample/window/copy review and no-causation boundaries |
| Parallel implementation hotspots | Shared tokens/routes/SDK/schema can create merge and regression risk | Packet ownership and orchestrator convergence; no independent shared edits |

## Explicit implementation-ready acceptance criteria

The following criteria are for a later implementation campaign. They are not claimed as satisfied by Campaign 029.

### Product flow

- A clean first launch reaches a comprehensible Today surface without account/network setup.
- Home presents one obvious Start/Continue action and visible workout progress.
- A returning player can resume the persisted workout at the correct unfinished leg.
- The full standard workout flows from intro/tutorial through gameplay, per-game result, next game, and completion without duplicate session/reward writes.
- Pause, system back, quit, relaunch, and error states make data consequences explicit and preserve safe resume behavior.

### Games

- All 42 registry/catalog entries remain discoverable through category/search/favorites or an intentional empty/filter state.
- Suggested Next and Browse All are understandable as different jobs.
- Game Detail makes Play and the mechanic clear before deep analytics.
- At least eight representative interaction families retain their real mechanics and shared SDK lifecycle.
- Game identity motifs never replace instructions, reduce touch reachability, or introduce unsupported benefit claims.

### Progress and language

- Progress overview answers consistency, recorded-performance movement, and next consideration in one summary-first view.
- Domain, game, activity, and advanced history remain reachable without duplicative/confusing ownership.
- Sparse, loading, error, offline, and no-history states are distinct.
- Copy uses personal recorded evidence and never makes medical, neurological, intelligence, age-reversal, or broad real-world claims.

### Motivation, trust, and settings

- Rewards has one claim inbox/claim-all owner; Profile exposes a summary/link rather than duplicating the full store.
- Streak, quests, achievements, milestones, mastery, XP, coins, rerolls, and cosmetics have one readable hierarchy and do not compete with Start/Next.
- Theme, audio, haptics, accessibility, export, restore, merge/replace, and typed-delete safeguards remain reachable.
- SQLite schema, backup/restore, ledger, session identity, progression, reward idempotency, and version/provenance contracts remain intact.

### Accessibility/performance/validation

- Minimum 44 dp targets, semantic IDs/labels, text scaling, contrast, screen-reader order, color-independent state, reduced motion, and sensory toggles pass on Android and iOS where applicable.
- Current QA harness can exercise catalog, canaries, workout, resume, persistence, and result navigation at the exact implementation SHA.
- Typecheck, lint, affected tests, registry/provenance/offline/security validators, dependency policy, OpenSpec, and build/runtime checks are recorded honestly.
- Human participants can complete the phase task without critical confusion; findings and unresolved uncertainty are documented.
- Any implementation diff is reviewed to ensure no accidental source, schema, generated, CI, or dependency change is mixed into a redesign-only phase.

## Deliverables and final campaign boundary

This master plan, together with the five supporting documents in `docs/redesign/`, is the complete Campaign 029 discovery package. The package records what was inspected, what was not reachable, what the current repository already does well, why the current interface feels structurally dense, what the proposed IA owns, how the golden path should behave, how Games and Progress should be simplified, which systems are demoted rather than deleted, what visual direction follows from the IA, how a later implementation maps to real seams, and how humans must validate it.

**No product redesign has been implemented.**

## Campaign 030B evidence addendum (2026-09-17)

Campaign 030B closed the historical Android framebuffer limitation on a
disposable normal Pixel 7 AVD. The Campaign 029 hierarchy-based hypotheses are
now cross-checked against current light/dark rendered pixels and a deterministic
four-game runtime journey; the detailed classifications are in
`evidence/campaign030b/CAMPAIGN029_VISUAL_CROSSCHECK.md`.

Two current-baseline facts qualify the plan without changing its direction:

- Data Management can display `Local database — Empty` while its local table
  counters contain persisted sessions/workout/tutorial rows. This is a storage
  size observability/trust issue, not observed data loss, and requires explicit
  follow-up before a later implementation treats that label as authoritative.
- The populated Progress Detail fixture exposes a 43dp history row in each
  theme, and the Games/Profile audit retains clipped-under-tab-bar notes. These
  are localized accessibility/layout follow-ups alongside the plan's existing
  density and human-comprehension hypotheses.

The original Campaign 029 statements about unavailable current rendered runtime
remain historical statements about that campaign head. Campaign 030B supplies
the missing Android evidence; it does not provide human usability, iOS,
large-font, landscape, or exhaustive 42-game validation, and it implements no
redesign.
