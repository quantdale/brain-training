# Campaign 029 — Product Surface Inventory

**Current head:** `13c0e5d85a270edb8e41a676437c6bdf3c81f441`
**Purpose:** map the user-facing product and its supporting systems before changing information architecture.
**Evidence rule:** rows tagged **[Verified in source]** describe current implementation; **[Inferred]** rows are redesign hypotheses, not usability-test results. Runtime observations that could not be made at this head are recorded in `RUNTIME_EVIDENCE.md`.

## Disposition vocabulary

- **Core — preserve and strengthen:** essential to the product promise; improve framing, hierarchy, or feedback.
- **Core — progressively disclose:** keep the capability, move it behind a clear summary/detail boundary.
- **Support — consolidate:** keep the behavior but give it one obvious owner and one vocabulary.
- **Secondary — move below the fold:** useful after the main job, but should not compete with it.
- **Optional — hide from primary journey:** retain for interested players or recovery/settings paths.
- **Question — validate before investment:** current value or comprehension is not established.

## Critical-path definition

The primary product path for this inventory is:

`launch → understand Today → start workout → game intro/tutorial → gameplay → per-game result → next game → workout completion → exit or continue`

The deliberately separate path for intentional choice is:

`launch → Games → discover/search/filter → game detail → play → result`

Progress, Profile, Rewards, and Data Management support those paths but should not compete with them at launch.

## Screen and route inventory

### Shell, launch, and navigation

| Surface / entry | User job and actions | Information and dependencies | Load, duplication, and concern | Value / maturity / disposition |
|---|---|---|---|---|
| Root bootstrap / loading (`app/_layout.tsx`) | Open the product and get to a trustworthy ready state; retry if storage cannot open | SQLite initialization, registry registration, progression seeding, profile settings, theme, audio/haptics, toast host | **[Verified in source]** several startup responsibilities are coordinated in one root boundary; loading is not a product education moment | High infrastructure value; mature and guarded. **Core — preserve and strengthen** with a brief purposeful loading/error treatment |
| Storage unavailable (`storage-unavailable`) | Understand that local data could not open and retry safely | Error state, retry callback, local database failure | **[Verified in source]** recoverable and storage-specific; exact runtime appearance unobserved | Trust-critical. **Core — preserve and strengthen**; never hide or replace with a fake empty state |
| Native/web tab shell (`(tabs)/_layout`, `app-tabs`) | Move among Home, Games, Progress, Profile without losing orientation | Four labeled destinations, selected indicator, platform-specific tab implementation | **[Verified in source]** labels and test IDs are centralized. **Inferred** the labels are stable enough to preserve; screen jobs need sharper ownership | High navigation value. **Core — preserve and strengthen** |
| First launch / onboarding | Learn what the product is, choose a low-friction starting intent, start first session | **[Verified in source]** no dedicated onboarding route; new-player states and tutorial infrastructure exist | **[Uncertain]** exact first-launch sequence and comprehension cannot be observed without a device. The absence of a dedicated path risks showing returning-user density to a new user | **Question — validate before investment**; plan a small optional first-run path, not an account wall |

### Home / Today and workout surfaces

| Surface / entry | User job and actions | Information and dependencies | Load, duplication, and concern | Value / maturity / disposition |
|---|---|---|---|---|
| Home / Today’s Workout (`(tabs)/index`) | Know what to do today; start or continue the workout | Four-game daily mix, x/4 progress, leg states, primary Start/Continue, daily selection from ratings/recency/personalization, persisted workout instance | **[Verified in source]** this is the most direct expression of the product promise. **[Inferred]** it competes with several other Home blocks for first attention | Highest product value. **Core — preserve and strengthen** as the dominant above-fold action |
| Daily workout progress / leg list | See whether a workout is complete and what comes next | Done / Now / Up next states, game names, route provenance, next-game navigation | **[Verified in source]** progress is explicit. **Inferred** four equal legs may still ask the player to parse the plan before acting | Core. **Core — preserve and strengthen** with one dominant next leg and concise preview |
| Workout configuration / More workouts | Choose intent, focus category, and length; start/resume alternate templates | `daily-mix`, eight generated focus templates, Short/Standard/Extended, explanation/“why,” completion state, persisted instances | **[Verified in source]** it is data-gated and includes many choices. **Inferred** exposing configuration beside Today increases choice load and weakens “just start” | Valuable for returning/intentional users. **Support — consolidate** behind a secondary “Choose a workout” entry |
| Reroll affordance | Reject today’s selection and request another | Free-first / escalating coin cost, five-attempt cap, disabled/exhausted/error copy, persisted attempt metadata | **[Verified in source]** economy and failure copy are explicit. **Inferred** a new user sees an optimization decision before learning the workout value | Retain for control and fairness. **Optional — hide from primary journey** until the player opens workout options |
| Streak and at-risk block | Know whether daily consistency is at risk and act | Current/longest streak, day dots, next milestone, Freeze/Shield/Recovery context | **[Verified in source]** Home shows streak rhythm and at-risk warning; Profile also owns detailed streak tools | Motivating but duplicative. **Secondary — move below the fold**; deep management belongs to Profile/Motivation |
| Level / XP / coin chips | See progression and balances | Level ring, XP progress, coins, session awards | **[Verified in source]** balances appear in Home and Profile and rewards. **Inferred** three numeric currencies in the hero compete with the training action | Keep as lightweight status, not a competing CTA. **Support — consolidate** vocabulary and placement |
| Spotlight / milestone / mastery strip | Notice a featured challenge or next achievement | Daily Spotlight, mastery milestone, reward celebration | **[Verified in source]** Home includes these contextual strips. **Inferred** each is a different “reason to play next” | Keep as one optional context slot. **Optional — hide from primary journey** when Today is incomplete |
| Recent games / workout history | Resume memory of activity | Up to five recent games and four workout-history rows | **[Verified in source]** Home renders both; Progress also has recent/history views | Useful after today. **Secondary — move below the fold** or combine into a single “Recent training” entry |
| Post-completion Home summary | Recognize completion and choose next activity | Workout completion state, summary, Browse games / Progress / Rewards quick actions, celebration host | **[Verified in source]** completion and quick actions exist. **Inferred** three equally weighted exits can dilute satisfaction | Core. **Core — preserve and strengthen** with one recommended next action plus two quiet alternatives |

### Games and game detail

| Surface / entry | User job and actions | Information and dependencies | Load, duplication, and concern | Value / maturity / disposition |
|---|---|---|---|---|
| Games library (`(tabs)/games`) | Explore or deliberately choose a game | Header/copy, featured hero, search, category chips/counts, favorites filter, 42-game grid, empty state | **[Verified in source]** feature hero, three shelves, filters, and grid coexist. **Inferred** the screen has both recommendation and database jobs without a primary mode | High discovery value. **Core — preserve and strengthen** through progressive layering |
| Featured game hero | Pick a recommended starting point and open its detail | One evidence-backed recommended game, domain tint, “Open game details” | **[Verified in source]** recommendation derives from a snapshot. **Inferred** one hero is clearer than multiple rails if its reason is plain | Core discovery aid. **Core — preserve and strengthen**; make rationale short and actionable |
| Discovery shelves | Find a game based on recommendation, PB proximity, or rustiness | Recommended for today, Near a personal best, Getting rusty; capped collapsed shelves and See all | **[Verified in source]** three rule-based shelves exist. **Inferred** all three simultaneously create competing recommendations | Useful recommendation system. **Support — consolidate** into one “Suggested next” rail plus a deeper filter/context view |
| Search / category / favorite filters | Narrow a known or preferred game | Search query, eight categories, counts, favorites-only toggle, no-results state | **[Verified in source]** controls are present. **Inferred** filter density is appropriate after intent is established, not as the first visual block | Core utility. **Core — preserve and strengthen** with search as secondary utility and categories as a clear browse mode |
| Game grid / GameCard | Scan a broad catalog and choose | Domain ribbon/monogram, category, name, description, mastery/favorite, tap to detail | **[Verified in source]** cards reuse domain identity and mastery. **Inferred** 42 cards risk reading like a database if identity and grouping stay shallow | Core catalog. **Core — preserve and strengthen** with authored game signatures and compact hierarchy |
| Game detail (`game-detail/[id]`) | Decide whether to play and understand current record | Game hero, category, description/tutorial note, mastery ring/tier/next milestone, Play/favorite, sessions/best/average, trends, recent sessions, version metadata | **[Verified in source]** detail is evidence-rich and has a clear Play CTA. **Inferred** metadata and records may be too prominent before first play | Core decision surface. **Core — preserve and strengthen**; first viewport = identity, promise, Play; evidence below |

### Gameplay lifecycle

| Surface / entry | User job and actions | Information and dependencies | Load, duplication, and concern | Value / maturity / disposition |
|---|---|---|---|---|
| Game route loader (`game/[id]`) | Reach a selected game reliably | Registry lookup, lazy loader, tutorial hydration, workout provenance, Suspense/error boundary | **[Verified in source]** route is a structural adapter, not a second game UI | Essential infrastructure. **Core — preserve and strengthen** only where loading/error copy affects trust |
| Shared game intro (`GameHost` intro) | Understand the rule and commit to a round | Domain-tinted hero, game name/category, description, difficulty, reward, Start, How to play | **[Verified in source]** shared intro exists for every GameHost game. **Inferred** reward/difficulty metadata can distract from one actionable rule | Core. **Core — preserve and strengthen** around one sentence, one example, one Start |
| First-run tutorial overlay | Learn the interaction before risking a result | Tutorial store, instructional steps, game-specific hints, help affordance | **[Verified in source]** tutorial availability is true for all 42 games and first-use state is persisted. **Inferred** tutorial copy quality differs by mechanic and needs human review | Core onboarding-to-play bridge. **Core — preserve and strengthen** with interaction-first content |
| In-session HUD | Execute the task and understand time/progress | Pause, round/progress, score and game-specific state; audio/haptics/motion providers | **[Verified in source]** shared lifecycle/HUD and game-specific boards exist; per-game mechanics vary widely | Highest gameplay value. **Core — preserve and strengthen**; keep chrome quiet and task dominant |
| Pause / quit / abandon | Interrupt safely and resume or exit intentionally | Opaque pause overlay, hardware-back handling, resume/quit actions, persisted lifecycle state | **[Verified in source]** pause freezes timers and has shared behavior; current visual runtime unobserved | Trust-critical. **Core — preserve and strengthen** with explicit consequences and no accidental loss |
| Per-game results (`GameResults`) | Understand performance, reward, and next action | Score/accuracy/time/difficulty, rating/XP/currency reward, Play again/Done, workout advance | **[Verified in source]** shared results chrome exists. **Inferred** it should be the simplest transition surface, not another analytics dashboard | Core. **Core — preserve and strengthen** with result → next-game hierarchy |
| Global results (`results`) | Review a persisted session and choose what next | Hero/performance band/ring, PB, XP/date, four stats, workout completion, rating movement, recent sessions, Play again/Next/Done/Browse | **[Verified in source]** route is 627 lines and has several sections. **Inferred** it can easily over-explain one completed round and compete with Next | Core evidence. **Core — progressively disclose** deeper history below one next action |
| Workout completion | Feel finished and know what remains | Completed legs, total/summary, rewards, next/browse/progress exits, completion celebration | **[Verified in source]** completion card and workout advance semantics exist in results/Home. **Inferred** the completion moment needs one clear endpoint rather than three equal destinations | Core. **Core — preserve and strengthen** |

### Progress and analytics

| Surface / entry | User job and actions | Information and dependencies | Load, duplication, and concern | Value / maturity / disposition |
|---|---|---|---|---|
| Progress overview (`(tabs)/progress`) | Answer consistency, apparent training-performance movement, and next focus | 7d/30d/90d/all filters, composite rating hero, Level/XP/Sessions/Coins, eight domain cards, balance, heatmap/calendar, volume, recent/lifetime, PB history, workout completion, category comparison, co-occurrence breadth, full history, per-game lists, recent sessions, mastery insights | **[Verified in source]** 1368-line route contains many valid metrics and deep links. **Inferred** this is the clearest structural source of “analytics console” risk | High evidence value, poor default density. **Core — progressively disclose** |
| Progress activity (`progress-activity`) | Inspect consistency over time | Calendar/activity summary, current/longest streak, frequency, weekdays/month patterns | **[Verified in source]** detailed activity route exists; overlaps Home/Profile streak language | Valuable for committed users. **Core — progressively disclose** under Consistency |
| Progress detail (`progress-detail`) | Inspect all-up performance evidence | PB/domain history, rolling average, accuracy, reaction, game records/recent | **[Verified in source]** broad aggregate detail route. **Inferred** name is generic and hierarchy is hard to predict | Valuable advanced view. **Support — consolidate** under “Performance details” |
| Progress domain (`progress-domain`) | Understand one domain and what to train next | Window, rating/freshness/movement/best/history/trend/accuracy/reaction/difficulty/activity/games/recent | **[Verified in source]** strong domain evidence and drill-down. **Inferred** should be the main explanatory detail when overview says “focus here” | Core drill-down. **Core — preserve and strengthen** |
| Progress game (`progress-game`) | Understand one game’s history | Records/trend/rolling average/PB/score history/difficulty/recent sessions | **[Verified in source]** overlaps Game Detail’s records/trends/recent sessions | Valuable but duplicative. **Support — consolidate** with Game Detail’s evidence section or make the distinction explicit |
| Charts / comparisons / co-occurrence | Explore relationships in history | Rolling values, category comparisons, breadth/co-occurrence without causation claims | **[Verified in source]** analytics includes disclaimers around no causation. **Inferred** advanced evidence should be opt-in and labeled with plain language | Useful for power users. **Optional — hide from primary journey** |

### Profile, motivation, and trust

| Surface / entry | User job and actions | Information and dependencies | Load, duplication, and concern | Value / maturity / disposition |
|---|---|---|---|---|
| Profile overview (`(tabs)/profile`) | Manage identity, preferences, and personal systems | Local player hero, level/accent, Level/Streak/XP/Coins, XP bar, streak, quests, achievements, cosmetics, Rewards, Data Management, theme, sensory settings | **[Verified in source]** route is approximately 1397 lines and contains all of these sections. **Inferred** it is a combined profile, motivation hub, store, and settings console | Some value, but biggest density hotspot. **Support — consolidate** into Profile/Settings with explicit groups |
| Identity / level summary | See who the local profile is and current level | Local player, level/accent, XP | **[Verified in source]** no account/cloud identity is implied | Core trust/identity. **Core — preserve and strengthen** but make it quiet |
| Streak detail / protection | Protect or recover daily consistency | Current/longest, milestones, Freeze/Shield/Recovery purchase/apply, coin balance | **[Verified in source]** rules are persisted/idempotent and costs are explicit. **Inferred** this is too consequential to hide inside a long generic Profile scroll | Motivational/support value. **Support — consolidate** in a Motivation hub with clear rules |
| Quests | Complete short-period goals and claim rewards | Active daily/weekly/long-term definitions, progress, claims | **[Verified in source]** 16 definitions, deterministic selection and idempotent claims | Potentially motivating, but one of several goal systems. **Support — consolidate** into a single “Next rewards” inbox |
| Achievements / milestones | Recognize long-term progress and claim rewards | 37 current achievement definitions observed, progress, unlocked/claimed state, streak milestones | **[Verified in source]** separate engine and UI treatments exist | Valuable as retrospective recognition. **Secondary — move below the fold** / unify claim state |
| Cosmetics / collection | Customize profile and celebrations | Three slots (`avatarFrame`, `accent`, `celebration`), 12 definitions, owned/equipped/locked/purchase states | **[Verified in source]** purchase and equip are idempotent and stored locally | Optional identity expression. **Optional — hide from primary journey**; keep accessible |
| Rewards route (`rewards`) | Find and claim available rewards and customize | Claimable inbox, Claim all, balance, reward history, cosmetic collection/equip/buy | **[Verified in source]** this is already a unified reward surface, but Profile also previews the same systems | Strong candidate for one owner. **Support — consolidate**; Profile gets a summary/link only |
| Theme and sensory settings | Control visual/audio/haptic comfort | Light/dark/system theme, SFX/haptics toggles, persisted settings | **[Verified in source]** live providers and persistence/toast failure path exist | Trust/accessibility value. **Core — preserve and strengthen** under Settings |
| Data Management (`data-management`) | Understand, export, restore, or delete local data | Local counts, storage bytes, JSON export/share, saved backups, merge/replace import, warnings, typed DELETE wipe | **[Verified in source]** safe two-step destructive gates and local-only copy exist; route is long | High trust value, not a daily job. **Core — progressively disclose** under Settings/Data |

## System inventory and ownership pressure

| System | Current source seam | Player-facing output | Dependency / risk | Proposed ownership |
|---|---|---|---|---|
| Game catalog | `games/*/game.json`, generated registry | 42 games, categories, descriptions, versions | Generated truth must not be hand-edited | Games + game detail |
| Game SDK | `src/sdk`, `components/game-host` | Consistent intro/session/results/pause/tutorial contracts | Shared seam; changes affect all games | Gameplay shell |
| SQLite persistence | `src/db`, schema v12 | Offline sessions, ratings, history, rewards/settings | Canonical data integrity; preserve migrations | Invisible foundation; surfaced through appropriate summaries |
| Workout engine | `src/workout` | Daily mix, focus templates, lengths, resume, completion | Determinism/provenance/reroll semantics | Home/Today; configuration secondary |
| Personalization | `src/workout/personalize`, discovery | Weak/stale/novelty/PB-aware choices and explanations | Recommendations need understandable reasons | Home Today + one Games suggestion |
| Rating / performance | `src/rating`, analytics | Domain/game performance, PB, trends | Must not become medical or ability claim | Progress and game detail |
| Mastery | `src/mastery` | Per-game tier and next milestone | Another ladder beside XP/level | Game detail; compact Progress distribution |
| XP / levels | `src/rating`, `db/xpAwards` | Session rewards and level progress | Numeric status can compete with training result | Results/Profile summary; not Home hero lead |
| Coins / ledger | `src/db`, `rewards`, streak/reroll actions | Purchases and reroll/protection costs | Economy explanation burden | Rewards/Settings support; no primary CTA |
| Streaks | `src/streaks` | Consistency, milestones, protection | Can feel punitive if over-emphasized | Home compact rhythm; Motivation detail |
| Quests | `src/quests` | Daily/weekly/long-term goals | Three time horizons add mental load | Unified Motivation/Rewards inbox |
| Achievements | `src/achievements` | Long-term recognition/claims | Large definition catalog | Rewards/History secondary |
| Cosmetics | `src/cosmetics` | Customization | Store/collection states | Profile/Rewards only |
| Rewards inbox | `src/rewards` | Claim-all and reward history | Duplicate claim surfaces | Single owner at Rewards |
| Daily Spotlight | `src/spotlight` | Featured game/difficulty | Another “play this” recommendation | Optional Home/Games context, never a third hero |
| Data portability | `src/data-portability`, route | Export/restore/wipe | Destructive operations must remain explicit | Profile → Settings → Data |
| Accessibility infrastructure | `src/components/a11y`, stable test IDs, contrast tests | Screen-reader names, touch targets, contrast | Current-head runtime a11y not observed | Cross-cutting acceptance gate |
| Audio/haptics/motion | providers, Reanimated/shared motion | Feedback, pause/resume, celebrations | Must support reduced sensory load | Cross-cutting, user-controlled |
| QA automation | `scripts/qa/autobot.mjs`, Android scripts | Reproducible gameplay/flow evidence | Current device unavailable | Cross-cutting release gate |

## Catalog coverage

**[Verified in source]** The registry and `game.json` census agree on 42 games. Primary categories and IDs are listed below so later design work does not invent a catalog from screenshots.

| Primary domain | Count | Current catalog IDs |
|---|---:|---|
| Attention | 5 | `attention-odd-one-out`, `attention-sustained-vigilance`, `attention-symbol-tracker`, `attention-target-count`, `attention-visual-search` |
| Flexibility | 5 | `flexibility-card-sort`, `flexibility-color-stroop`, `flexibility-cue-shift`, `flexibility-rule-flip`, `flexibility-task-switch` |
| Language | 5 | `language-context-fit`, `language-sentence-builder`, `language-word-chain`, `language-word-match`, `language-word-scramble` |
| Logic & Problem Solving | 5 | `logic-code-cracker`, `logic-deduction-table`, `logic-next-sequence`, `logic-order-path`, `logic-rule-grid` |
| Math | 5 | `math-equation-builder`, `math-fast-math`, `math-missing-operator`, `math-number-line-estimation`, `math-value-ordering` |
| Memory | 7 | `memory`, `memory-grid-recall`, `memory-pair-recall`, `memory-pattern-tap-back`, `memory-prospective-cue`, `memory-running-order`, `memory-sequence-memory` |
| Spatial | 5 | `spatial-coordinate-turn`, `spatial-fold-match`, `spatial-grid-nav`, `spatial-mental-rotation`, `spatial-transform-match` |
| Speed | 5 | `speed-color-match`, `speed-order-sweep`, `speed-quick-compare`, `speed-reaction-time`, `speed-tap-rush` |

`language-word-match` is catalog-visible but **[Verified in source]** excluded from workout selection. This should be an intentional product explanation or a quiet implementation detail, not an accidental mismatch exposed as a broken recommendation.

## Representative game implementation coverage

**[Verified in source]** The following eight modules were read end-to-end enough to inspect their definition, generator/content path, reducer/hooks, scoring/session path, screen/components, version metadata, and tests. They cover distinct interaction patterns; they are not claimed to represent every visual detail in all 42 games.

| Representative module | Interaction family | Identity opportunity | Shared behavior to retain |
|---|---|---|---|
| `attention-odd-one-out` | Timed grid target; tap the one odd item | Visual search / “spot the outlier” motif | GameHost intro, timer, result/persistence, QA force-win |
| `memory-grid-recall` | Study a pattern, then recall hidden cells | Reveal → remember → reconstruct rhythm | Tutorial, pause freeze, versioned generator/scoring |
| `speed-reaction-time` | React to a signal / Go-No-Go timing | Signal/lightning/reaction motif | Timing instrumentation, legitimate interaction, results |
| `math-equation-builder` | Choose numbers/operators to form a valid equation | Construction / proof motif | Input semantics, evaluator, failure explanation, session contract |
| `language-word-match` | Content-backed option matching | Word/meaning/association motif | Content validation, tutorial, results; workout exclusion preserved |
| `logic-rule-grid` | Deduce/solve from symbols and rules | Investigation / constraint-solving motif | Solver options, difficulty metadata, pause/results |
| `flexibility-card-sort` | Sort by a changing rule | Rule-switch / adapt motif | Switch notice, interaction feedback, lifecycle |
| `spatial-transform-match` | Observe a source transform and choose a match | Rotate/transform motif | Hidden-source choice phase, a11y labels, speed scoring |

**[Inferred]** Stronger game identity should be authored around these interaction verbs and perceptual motifs, then expressed through restrained icons, illustration, copy, sound/haptic cues, and transitions. Category color alone should remain a taxonomy signal, not carry the whole brand burden.

## Coverage ledger

| Inspected | Method | Excluded or not current-head validated |
|---|---|---|
| All primary app routes and pushed routes listed above | Route file inventory, source reads, route tests/exports | Rendered current-head screens, because ADB/device boot was blocked |
| All 42 `game.json` entries and generated registry | `autobot --list-games`, registry check, generated file read | Full interaction of every game on device |
| Eight representative games | Source/test/module reads | Remaining 34 modules’ detailed screen copy/layout |
| Shared shell, UI kit, theme, GameHost/GameResults | Source reads and tests | Human perception of current theme on physical/small device |
| Workout, rating, mastery, progression, rewards, portability | Source reads, test suite, metadata/validator outputs | Real-player economy comprehension |
| CI/workflows and historical campaign evidence | `gh` API, Git log, `.agent` validation docs | Root cause of runner failures; GitHub exposed no steps/logs |
| Refero styles/screens/flows and official product sources | MCP retrieval and web opens | Unavailable private/interactive product behavior beyond official pages |
| Generated binaries, `node_modules`, caches, old QA output | Excluded from product source census | No claims are made from them except explicitly tagged historical evidence |
