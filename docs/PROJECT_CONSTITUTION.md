# Product & Autonomous Development Constitution v1.0

**Status:** LOCKED / DECISION FREEZE  
**Implementation:** not yet started at repository bootstrap  
**Repository:** `quantdale/brain-training` (product branding intentionally deferred)

This document is the authoritative set of locked product and development decisions. Agents must not casually reopen these decisions. Intentionally deferred items are listed near the end.

## 1. Mission and audience

The app is personal-first for the owner, while public Android/iOS release remains possible. Production-grade stability and maintainability are desired even though commercialization is deferred.

The product combines the useful feature/mechanic space of major brain-training apps without copying proprietary names, art, text, question banks, exact level layouts, branding, or distinctive UI. Target functional/mechanical parity, not literal cloning.

Children should be able to use the general experience appropriately, but child accounts, parental dashboards, and dedicated kids mode are not current scope.

## 2. Platforms and form factor

- Android + iOS eventual targets
- Android-first implementation and autonomous QA
- phone-first UI
- reasonable tablet/iPad scaling, not first-class tablet UX initially
- portrait-first
- provisional floors: Android 12+, iOS 17+
- 60 FPS baseline; 120 FPS where practical on capable devices

## 3. Preferred stack

- React Native
- Expo
- TypeScript
- SQLite as canonical local persistence
- Reanimated for polished animation/interactions
- Skia where specific games benefit from richer 2D rendering

Native Swift/Kotlin modules are not the default and require demonstrated need. No planned wholesale native rewrite.

## 4. Product personality

Polished/minimal like Elevate in clarity, but more playful, colorful, and videogame-like. Prioritize fun, replayability, engagement, responsive interaction, and challenge rather than clinical/scientific positioning.

Do not make unsupported claims about increasing IQ, preventing dementia, treating conditions, or medically improving cognition.

Not currently included: IQ tests, personality tests, EQ assessments, mental-health assessments, health integrations.

## 5. Offline-first

Core gameplay, workouts, scoring, progress, XP, ratings, achievements, currency, settings, history, and locally available content must work offline. Network/cloud is secondary.

## 6. Profiles, accounts, and sync

One persistent local profile per device initially. Accounts are optional and deferred. Eventual providers may include Google, Apple, and email/password.

Future signed-in sync is local-first and asynchronous: gameplay writes locally and never waits on network availability. Signing in later must preserve and deterministically merge local progress rather than reset it.

Data-type-specific conflict semantics are required where relevant (e.g. keep both completed sessions, merge ledger entries, preserve valid bests, reconstruct streak state from activity history). Supabase is the preferred current backend direction but implementation is deferred.

## 7. Data ownership/privacy

Eventually support full manual backup/export/import, merge or replace restore with validation/preview, optional password-encrypted backups, and complete deletion with backup offered first.

No selling user data. No analytics/crash telemetry for now. Advertising remains a deferred future option.

## 8. Library taxonomy

Primary categories:

1. Memory
2. Attention
3. Speed
4. Math
5. Language
6. Logic & Problem Solving
7. Flexibility
8. Spatial

A game may contribute to multiple internal domains but has one primary browse category.

## 9. Session and difficulty model

Most games target roughly 1–3 minute score-attack sessions with internal rounds as appropriate. There is no universal lives/hearts system; each game defines its own mistake/failure mechanics.

Player-facing difficulty uses named modes such as Easy, Normal, Hard, Expert, Adaptive. Internally, games use finer-grained parameters and continuous challenge/skill estimates. Manual easy play may still earn participation XP but should not inflate skill ratings.

## 10. Procedural/content model

Prefer effectively unbounded deterministic procedural generation where appropriate. Generators use explicit seeds, difficulty parameters, and versions. Generated challenges must be validated for correctness/solvability/ambiguity where relevant. Avoid recent near-duplicates.

Content strategy is game-specific: procedural for many math/memory/spatial games; validated templates for logic; curated/versioned packs for vocabulary, reading, grammar, etc. Keep initial install size reasonable and allow optional/lazy downloadable packs later. Downloaded packs remain usable offline until removed.

## 11. Game SDK/module architecture

Every game is a self-contained module with its own mechanics, generator/content logic, scoring, UI, tutorial, metadata, and tests while plugging into a mandatory shared Game SDK.

Shared SDK responsibilities include session lifecycle, timers, pause/resume, seeded RNG, results, XP/rating integration, audio/haptics, diagnostics, QA hooks, and version metadata.

Meaningful variants may exist under one core game. Poor/redundant games can be redesigned/deprecated/removed.

If the process is killed mid-game, restart that short game rather than implementing exact mid-session restoration. Completed sessions persist atomically. Backgrounding while alive auto-pauses.

Pause freezes timing and obscures the challenge using an opaque blur/overlay so pausing cannot be used to study the answer.

## 12. Tutorials

First play shows a short interactive tutorial where practical. It is skipped after completion but replayable from help/info. QA can bypass tutorials instantly.

## 13. Navigation/home

Bottom tabs: Home, Games, Progress, Profile/More.

Home is a mixed dashboard with Today's Workout as the primary CTA, followed by streak/XP/level, quests, recent performance, favorite/recent games, and rewards/currency while keeping the first viewport clean.

## 14. Daily Workout

Normally four games. Selection balances weaker/declining/undertrained domains, recency avoidance, randomness, and occasional stronger-domain variety. Softly avoid same-game consecutive days when alternatives exist.

One free reroll; additional rerolls may cost normal in-game currency. Daily systems use the local calendar date and deterministic date-derived seeds where useful.

## 15. Scoring/ratings

Every game converts raw results through game-specific normalization before shared ratings:

raw result -> normalized performance -> expected-difficulty comparison -> domain update -> overall composite.

Expose a transparent overall performance score plus separate domain ratings. Ratings move gradually using hybrid history: lifetime provides stability while recent evidence has greater weight. Inactivity should not directly decay ratings; instead reduce confidence/mark stale.

## 16. Results and records

Result screens show a simple headline plus meaningful metrics such as score, accuracy, reaction time, difficulty, rating movement, XP, and personal records. Track multiple meaningful records where applicable.

## 17. XP/level/currency

One global player level driven by XP represents engagement; domain ratings are separate. Completed poor attempts still earn some XP; better play can add bonuses. XP requirements grow smoothly with no practical hard cap and no prestige reset that erases progression.

Start with one normal earnable gameplay currency. It may buy streak protection/recovery, themes, avatars, badges/effects, quest rerolls, and other non-pay-to-win rewards. It must not buy better scores or rating manipulation.

Currency uses an append-only transaction ledger, not only a mutable balance.

## 18. Streaks/rewards/quests

Missing a day normally breaks a streak. Support proactive Freeze/Shield and post-miss Recovery with later-defined costs/limits.

Daily rewards require meaningful activity, not merely opening the app. Support daily/weekly quests and long-term/special achievements with XP/currency/cosmetic rewards.

## 19. Social

No leaderboard, friends, leagues, or multiplayer for now. Progression is personal.

## 20. Visual/audio/haptics

One coherent design system across the app, with individual games allowed distinct visual identities. Animations are polished, responsive, short, and non-blocking.

Support SFX, optional conservative background music, and differentiated haptics with global off controls. Games remain playable muted. Provide global controls to reduce music, effects, haptics, strong particles/celebrations, and intensive animations.

Timing-sensitive games use suitable monotonic/high-resolution clocks rather than frame counts alone and should behave fairly across 60/120 Hz displays.

## 21. Progress/discovery/themes

Progress includes overall/domain histories, per-game analytics, accuracy, reaction time, difficulty progression, activity frequency, and records, with simple summaries first and deeper detail one tap away.

Support favorites, search/filtering, recently played, recommendations, and temporary New badges/discovery boost for new games.

Themes/cosmetics may alter backgrounds/surfaces/accents/avatars/effects without compromising readability or gameplay semantics.

Historical results preserve scoring/generator/version metadata. Rebalancing must not silently reinterpret old results.

## 22. AI

AI is optional and not a core dependency. Likely future direction is an AI assistant with RAG over permitted game history/performance, app/game docs, training recommendations, and curated knowledge/content.

AI is advisory by default and must not silently modify authoritative ratings, XP, currency, streaks, or progression. AI-generated gameplay content must be validated before affecting scoring/ratings. Offline AI may be explored later but is not required.

## 23. Monetization boundary

Monetization is intentionally deferred. Possible future direction: free tier with broad access and usage limits/ads, paid tier with unlimited normal play/no ads, and separate consumable AI credits with possible bundled credits.

Normal gameplay, local progress, backup/export, and basic training must never require AI credits. A lightweight entitlement abstraction may exist early, but do not implement purchases/paywalls now.

## 24. Notifications/widgets/accessibility/storage

Notifications/widgets are deferred. When added, notifications should be conservative and configurable; first widget should be simple (streak, workout status, quick launch, maybe XP/level).

Full accessibility hardening is deferred, but architecture must not prevent it and global sensory controls should exist early.

Eventually provide storage management for base data, downloaded content, AI/generated cache, backups, and cache removal.

## 25. Autonomous development philosophy

Development is intended to be close to fully autonomous. A user should be able to start a goal in Kimi Code CLI, leave it running for hours, and later find coherent committed progress.

Use campaign-based bulk implementation and periodic user-invoked hardening rather than exhaustive feature-by-feature QA.

Kimi Code CLI is primary, with Codex/other agents supported through vendor-neutral repository state.

## 26. Swarm/concurrency

Use parallel coder agents for safely partitionable work, default ceiling about seven coders. Coder subagents primarily implement code/cheap tests; a single orchestrator owns expensive integration/runtime QA and normally one Android emulator.

Explicit write ownership is mandatory for parallel work. Shared hotspots are converged by the orchestrator. Temporary worktrees are acceptable when useful but must be automatically cleaned up.

## 27. Git

GitHub `main` is canonical. Commit/push coherent waves and useful blocked checkpoints frequently. Pushed main may be incomplete but should normally be buildable/startable.

No autonomous force-push. `--force-with-lease` requires explicit user authorization for a specific recovery operation.

## 28. Host interaction/resource modes

Routine automation may not move/inject the host mouse/keyboard, steal focus, constrain cursor movement, or depend on desktop coordinates. Use ADB, emulator-local input, accessibility hierarchy, semantic IDs, screenshots, and instrumentation.

One dedicated Android AVD. Day mode prioritizes workstation coexistence; Night mode may use more resources. User selects mode explicitly.

## 29. QA/quality gates

Normal validation is risk-based using an impact map. Shared Game SDK changes use representative canary games rather than every eventual game.

Critical/High regressions (build/start failure, major crash, data/progression/currency corruption, backup corruption, major breakage, serious sync/security issue) block feature continuation and must be repaired. Medium/Low findings may enter durable debt.

Never fake green. Unavailable validation is NOT VALIDATED/BLOCKED. Do not hide flakes with blind retries/sleeps/disablement.

QA infrastructure should support semantic IDs, deterministic seeds, fake clocks, fixtures, state forcing, structured failure artifacts, screenshots/logs, and version metadata. Dangerous QA hooks are unavailable in production builds.

Full hardening is started only by explicit user request and freezes feature development while deep QA/repair runs.

## 30. Repository/durable state

One monorepo. Durable architecture/product docs live under `docs/`; execution state lives under `.agent/`. Exactly one top-level active campaign at a time, with many parallel task packets allowed.

Fresh sessions must recover from committed repo state. Chat/session memory is disposable.

Task packets define objective, dependencies, allowed/prohibited write surfaces, completion criteria, cheap validation, and integration needs.

Dependencies may be updated intentionally; foundational replacements require ADR. Commit lockfiles. Deterministically generate generated artifacts. Version persistent formats. Preserve useful inline comments. Never commit secrets.

## 31. Initial phases

Phase 0: decision freeze / repository bootstrap.  
Phase 1: Autonomous Foundation.  
Phase 2: eight representative games (Memory, Attention, Speed, Math, Language, Logic & Problem Solving, Flexibility, Spatial).  
Phase 3: platform integration and autonomy/platform gate.  
Phase 4: large parallel catalog expansion.  
Later: user-invoked hardening, parity expansion, periodic iOS compatibility, cloud, AI, monetization, release work.

The initial eight games must deliberately exercise different architecture: deterministic sequence generation; rapid visual selection; precision reaction timing; validated procedural math; curated/content-pack language; procedural logic validation; rule-switching state machine; richer spatial rendering.

## 32. Mass-expansion gate

Do not mass-produce the catalog until:

- fresh-agent recovery works
- swarm partitioning/convergence works
- no host-input interference
- Android emulator is autonomously controllable
- QA failures produce useful diagnostics
- all eight representative games function
- Game SDK survives all represented mechanics
- scoring/rating/XP/currency/progress persistence and Today's Workout work
- light validation/canary suite works
- CI is green
- no unresolved Critical/High defects
- committed docs/state match repository reality
- clean main is pushed

## 33. Explicitly deferred decisions/systems

Do not arbitrarily lock these during unrelated work:

- final product name/branding
- Supabase sync implementation/configuration
- Google/Apple/email authentication implementation
- exact AI assistant/RAG design and corpus
- AI credit economics
- exact free-tier limits
- monetization/pricing/ads
- store release engineering
- notifications/widgets
- online content delivery/CDN
- elaborate cosmetics store
- production backend deletion workflow
- iOS autonomous QA
- full accessibility hardening
- social systems
- final public-release OS floors

## 34. Source-of-truth order

1. actual repository/code
2. this constitution + accepted ADRs
3. committed `.agent/` state
4. Git history
5. active campaign/task packets
6. session/chat memory

## 35. Definition of successful autonomous continuation

A normal successful development goal should materially advance the active campaign, safely converge parallel work, repair Critical/High regressions, pass appropriate light validation, update durable state, keep main buildable/startable, commit/push meaningful work, leave no temporary branches/worktrees, and record remaining work/blockers clearly.
