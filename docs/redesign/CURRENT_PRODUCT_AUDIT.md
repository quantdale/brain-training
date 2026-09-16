# Campaign 029 — Current Product Audit

**Investigation date:** 2026-09-16
**Repository:** `quantdale/brain-training`
**Current head investigated:** `13c0e5d85a270edb8e41a676437c6bdf3c81f441`
**Scope:** discovery and planning only. No app, test, dependency, build, persistence, schema, CI, or production behavior was changed.

## How to read this audit

This is an evidence record for the redesign master plan, not a claim that the application is already easy to use. Each statement is tagged:

- **[Observed]** — directly seen in current source, command output, a current artifact, or a current rendered/runtime attempt.
- **[Verified in source]** — confirmed by reading the named current-head implementation, generated registry, metadata, or test/harness contract.
- **[Verified by test/CI]** — confirmed by a command or historical CI/runtime record, with the date and SHA stated.
- **[Historical]** — comes from an earlier campaign record or earlier commit and is not substituted for current-head observation.
- **[Inferred]** — a design interpretation derived from the evidence; it is a hypothesis for later usability validation, not a measured result.
- **[Uncertain]** — the current environment or source does not settle the question.

## Integrity and scope

The repository was synchronized before investigation. The local branch was `main`, initially clean at `609f8ec`; `git fetch origin main` showed remote `main` advancing to `13c0e5d`, and `git merge --ff-only origin/main` fast-forwarded the worktree. No stash, reset, checkout, force operation, or deletion of user work was used. The post-sync worktree was clean and tracking `origin/main`.

The task prompt is `.agent/CAMPAIGN029_PRODUCT_REDESIGN_DISCOVERY_PROMPT.md`. Its write boundary is `docs/redesign/**`; the active-campaign file was intentionally not modified. All campaign outputs are therefore documentation/evidence only.

## Tool and environment availability

| Capability | Current availability | Evidence / limitation |
|---|---|---|
| Node | **[Observed] Available** | Node `v24.3.0` |
| npm | **[Observed] Available** | npm `11.4.2`; app package has `apps/mobile/package-lock.json` |
| Git | **[Observed] Available** | Git `2.50.0.windows.2`; canonical branch `main` |
| Expo / React Native project | **[Observed] Available** | Expo CLI commands ran from `apps/mobile`; Expo SDK 57 project |
| Android SDK / ADB | **[Observed] Available** | ADB `37.0.0-14910828`; SDK under `C:\Users\palac\AppData\Local\Android\Sdk` |
| Dedicated Android AVD | **[Observed] Present but unavailable at runtime** | `braintraining-qa36` exists; two headless boot attempts failed to register with ADB within 60 seconds |
| GitHub CLI/API | **[Observed] Available** | `gh` is installed and authenticated; read-only Actions run/job metadata was queried |
| Refero MCP | **[Observed] Available and used** | Style, screen, and flow searches plus full retrievals completed; see `REFERO_REFERENCE_MAP.md` |
| Web research | **[Observed] Available and used** | Official competitor/evidence-boundary pages were opened; source map is in `REFERO_REFERENCE_MAP.md` |
| Browser/UI runtime inspection | **[Uncertain / not completed]** | No current app could be attached to a running device; no current-head screenshot is claimed |
| Existing QA automation | **[Verified in source] Available** | `scripts/qa/autobot.mjs` supports catalog, canary, all, workout, resume, and certification modes |

## Repository census

### Top-level structure

**[Observed]** The repository contains the following meaningful top-level areas at the investigated head. Generated, cached, vendored, and historical QA output were read only as needed and are not treated as product source.

| Area | Role in the product or campaign |
|---|---|
| `apps/mobile/` | Expo React Native application, package manifest/lockfile, app config, Jest/Metro configuration |
| `apps/mobile/src/app/` | Expo Router routes, tab group, pushed game/progress/reward/data routes, route tests |
| `apps/mobile/src/components/` | Shared shell, UI kit, discovery, game chrome, progress, mastery, settings, sensory, reward components |
| `apps/mobile/src/games/` | 42 independently implemented game modules and their tests/assets/metadata |
| `apps/mobile/src/sdk/` | Mandatory Game SDK contracts, lifecycle, scoring/timing/tutorial/QA helpers and test IDs |
| `apps/mobile/src/registry/` | Registry loader plus deterministic generated catalog/lazy-loader index |
| `apps/mobile/src/db/` | SQLite initialization/migrations and repositories for canonical local state |
| `apps/mobile/src/workout/` | Daily/focus workout generation, persistence, metadata, reroll, resume and completion |
| `apps/mobile/src/rating/`, `mastery/`, `progression/` | Ratings, XP/level calculations, mastery summaries, quest/achievement synchronization |
| `apps/mobile/src/analytics/` | Aggregations/projections used by Progress, records, history, and evidence explanations |
| `apps/mobile/src/streaks/`, `quests/`, `achievements/`, `rewards/`, `cosmetics/`, `spotlight/` | Engagement and reward subsystems |
| `apps/mobile/src/data-portability/` | Export, backup, import/replace/merge, and local-data accounting |
| `apps/mobile/src/theme/` | Light/dark tokens, theme registry, contrast tests, theme resolution |
| `apps/mobile/src/notifications/`, `assistant/` | Supporting product capabilities; not primary tab destinations |
| `scripts/` | Deterministic registry generation, integrity/security/offline checks, QA harness, Android AVD tooling, performance probes |
| `.github/workflows/` | App CI, Android build smoke, iOS build smoke, repository integrity workflow |
| `.agent/` | Governance, campaign history, validation records, known issues and this campaign prompt; not modified for this campaign |
| `docs/`, `openspec/` | Constitution, architecture/recovery/QA docs, prior product/UI campaign decisions and OpenSpec changes |

### Current source-area scale

**[Observed]** A point-in-time census of `apps/mobile/src` found approximately 1,500 source/test files and 250,000 lines when all modules are included. The largest area is `games/` (1085 files, approximately 177,458 lines, 352 test files); the application routes are comparatively concentrated but long: Home is approximately 46 KB, Progress 50 KB, Profile 47 KB, Rewards 32 KB, and Data Management 34 KB. The following counts make the scale and likely ownership boundaries explicit; they are not a performance benchmark.

| Subsystem | Files | Approx. lines | Test files | Redesign relevance |
|---|---:|---:|---:|---|
| `app` routes | 34 | 20,522 | 17 | Primary information architecture and navigation surface |
| `components` | 116 | 12,231 | 33 | Shared visual/interaction seams; useful for a structural redesign |
| `db` | 39 | 9,188 | 18 | Canonical offline state; preserve contract during UI work |
| `workout` | 37 | 6,374 | 18 | Golden-path state and resume/completion logic |
| `analytics` | 29 | 6,148 | 7 | Valuable deep evidence; should be progressively disclosed |
| `sdk` | 31 | 3,764 | 16 | Reusable game lifecycle and QA contracts |
| `games` | 1085 | 177,458 | 352 | Product differentiator; avoid rewriting to solve shell hierarchy |
| progression / rewards / streaks / quests / achievements / mastery / cosmetics / spotlight | 67 | 8,626 | 28 | High feature density and hierarchy pressure |
| data portability / notifications / assistant | 38 | 7,375 | 17 | Secondary trust, settings, and future capabilities |

## Product architecture reconstructed from source

### App bootstrap and navigation

**[Verified in source]** `apps/mobile/src/app/_layout.tsx` initializes SQLite before rendering the ready state. A database-open/migration failure takes the user to the recoverable `storage-unavailable` route. Registry registration, progression seeding, profile reads, settings, audio/haptics, theme resolution, and toast hosting are wired at the root. The source explicitly treats post-database bootstrap failures as non-fatal.

**[Verified in source]** The primary native navigation is exactly four labeled tabs from `src/constants/tabs.ts` and `src/components/app-tabs.tsx`: Home, Games, Progress, Profile. The tab bar uses a filled accent indicator and retains labels for inactive destinations. Pushed routes sit outside the tab host: `game/[id]`, `game-detail/[id]`, `results`, four Progress detail routes, Rewards, Data Management, and Storage Unavailable.

**[Inferred]** This is a good stable top-level model for the redesign. The problem is not an absence of destinations; it is that each destination is asked to express too many jobs at once and pushed routes are not yet framed as a coherent task sequence.

### Games and registry

**[Verified in source]** The generated registry contains 42 games in eight primary categories: Attention (5), Flexibility (5), Language (5), Logic & Problem Solving (5), Math (5), Memory (7), Spatial (5), and Speed (5). Each registry entry carries primary/secondary domains, description, SDK/game/generator/content versions, tutorial availability, and a lazy screen loader. The source of truth is `apps/mobile/src/games/*/game.json`; `registry.generated.ts` is generated and validated for drift.

**[Verified in source]** `language-word-match` remains catalog-visible but is explicitly excluded from workout selection in `src/workout/reconcile.ts`. This is a current product rule, not a missing catalog entry.

### Shared Game SDK and gameplay chrome

**[Verified in source]** Every inspected representative module uses the shared SDK/GameHost lifecycle. The inspected set covered eight interaction families: `attention-odd-one-out` (timed visual target), `memory-grid-recall` (study then recall), `speed-reaction-time` (signal/reaction timing), `math-equation-builder` (structured input/evaluator), `language-word-match` (content/options), `logic-rule-grid` (solver/symbol options), `flexibility-card-sort` (rule-switch sorting), and `spatial-transform-match` (reveal/transform/choice). Each has versioned metadata and dedicated tests.

**[Verified in source]** `GameHost` supplies intro, session, results, tutorial overlay, HUD, pause overlay, lifecycle persistence and developer-only QA controls. `GameResults` supplies shared performance/reward/workout actions. This is a high-leverage reuse seam: a later redesign can improve the task framing and result hierarchy once, then preserve per-game mechanics.

### Workout and persistence

**[Verified in source]** The default daily workout is a deterministic four-game balanced mix; named focus templates are generated for each category. Supported lengths are Short (2), Standard (4, default), and Extended (6). The workout engine supports persistent instances, resume, next-game navigation, completion summary, metadata/provenance, personalized ordering, a free-first/paid reroll flow capped at five attempts per day, and a separate focus-workout picker.

**[Verified in source]** SQLite is canonical local persistence. The database schema is versioned at `SCHEMA_VERSION = 12`; repositories cover profile, sessions, ratings, history, ledger, favorites, quests, achievements, XP awards, workouts, and tutorials. Session/rating/XP/currency writes are designed around append-only or transactional invariants, with export/import support.

**[Inferred]** The underlying state model is richer than the current first viewport needs to expose. The redesign should retain provenance, resume, offline, and append-only guarantees while collapsing the number of choices and status explanations visible before a player starts.

### Progression and engagement systems

**[Verified in source]** The product currently exposes or computes all of the following: per-domain ratings, level and XP, coins, daily/weekly/long-term quests (16 versioned definitions), achievements (37 definition entries observed in the current definitions file), streak reconstruction, seven streak milestones (3/7/14/30/50/100/365 days), Freeze/Shield/Recovery inventory, mastery tiers from `unplayed` through `mastered`, deterministic Daily Spotlight, rewards inbox/claim-all, 12 cosmetics across three slots, favorites, workout rerolls, recent sessions, personal-best history, and backup/restore.

**[Inferred]** These are not all redundant in the engine. They are redundant in the user's mental model when presented as parallel “reasons to return.” A redesign should make one or two behaviors primary and let the other systems act as evidence, optional motivation, or customization.

## Current route and surface baseline

**[Verified in source]** The current route inventory is:

| Route | Current role |
|---|---|
| `(tabs)/index` | Home / Today’s Workout, streak/level/XP/coins, alternate workouts, reroll, recent/history/spotlight/milestones |
| `(tabs)/games` | Featured game, search, category/favorites filters, 42-game grid, three discovery shelves |
| `(tabs)/progress` | Time-windowed overview with composite rating, domain cards, activity, volume, PBs, workout/category comparisons, history and per-game drill-ins |
| `(tabs)/profile` | Identity, level, streak/inventory/milestones, quests, achievements, cosmetics, rewards link, data-management link, theme, sensory settings |
| `game-detail/[id]` | Game identity, mastery ring/tier, records, trends, recent sessions, Play/favorite |
| `game/[id]` | Lazy game mount and shared intro/session/results lifecycle |
| `results` | Global session result, performance band, PB/rating/XP/stats, recent sessions, workout continuation |
| `progress-activity` | Activity calendar, frequency, weekday/month patterns |
| `progress-detail` | Overall PB/history/rolling/accuracy/reaction/game records |
| `progress-domain` | Domain rating/freshness/movement/best/trend/activity/games/recent |
| `progress-game` | Game records/trend/rolling average/PB/score history/difficulty/recent |
| `rewards` | Claimable inbox, claim-all, cosmetic collection/equip/buy/history |
| `data-management` | Local counts, export/share, backup list, merge/replace import, delete-all |
| `storage-unavailable` | Recoverable database failure state |
| onboarding | **[Verified in source] No dedicated onboarding route found**; first-use is inferred from empty/new-player states and tutorial behavior |

The full surface-level disposition is in `SURFACE_INVENTORY.md`; the proposed ownership model is in `PROPOSED_INFORMATION_ARCHITECTURE.md`.

## Health baseline at the synchronized head

| Check | Result | Classification |
|---|---|---|
| `node scripts/validate-repo-state.mjs` | PASS; no active campaign, last 028 `VALIDATED` | **[Verified by test/CI] Current-head local** |
| `cd apps/mobile && npm ci --dry-run --ignore-scripts` | PASS, exit 0; lockfile resolution preview added 37 packages without installing or changing the worktree | **[Verified by test/CI] Current-head local** |
| `cd apps/mobile && npm run typecheck -- --pretty false` | PASS, exit 0 | **[Verified by test/CI] Current-head local** |
| `cd apps/mobile && npm run lint` | PASS, exit 0 | **[Verified by test/CI] Current-head local** |
| `cd apps/mobile && npm run test:ci` | PASS; 553 passed suites, 4 skipped; 6,548 passed tests, 5 skipped; 5 snapshots; 180.09 s | **[Verified by test/CI] Current-head local** |
| Registry generation `--check` | PASS; generated registry up to date | **[Verified by test/CI] Current-head local** |
| Provenance, offline, secret, ownership, affected-map validators | PASS; no drift, no network usage outside allowlist, no detected secrets, ownership/map synchronized | **[Verified by test/CI] Current-head local** |
| Workflow hygiene and self-test | PASS; four files, 44/44 self-tests | **[Verified by test/CI] Current-head local** |
| Dependency audit | PASS; five reviewed/accepted advisories, no unallowlisted moderate+ production finding | **[Verified by test/CI] Current-head local** |
| `npx openspec validate --all` | PASS; 15/15 changes | **[Verified by test/CI] Current-head local** |
| `npx expo-doctor` | FAIL 20/21: 14 Expo SDK-57 packages are one patch behind the installed SDK expectations | **[Verified by test/CI] Current-head local; do not fix in this campaign** |
| `npx expo export --platform web --output-dir D:\Temp\campaign029\web-export-1 --no-bytecode --max-workers 2` | PASS; 96 files and 20 static routes emitted outside the repository | **[Verified by test/CI] Current-head local** |
| `QA_OUT=D:\Temp\campaign029\qa-all-blocked node scripts/qa/autobot.mjs --mode all` | BLOCKED exit 2; 44 targets `NOT VALIDATED` because no ADB device was ready | **[Verified by test/CI] Current-head runtime attempt** |

The exact runtime evidence, target list, boot attempts, and historical comparison are in `RUNTIME_EVIDENCE.md`.

## Current-head contradiction audit

| Earlier claim or assumption | Current evidence | Trustworthy interpretation |
|---|---|---|
| Campaign 028 validation records describe a strong Android runtime baseline | Those records are tied to earlier SHAs and emulator-5560; current head has no usable device | **[Historical]** useful regression context, not current-head proof |
| The repository is in a terminal/no-active-campaign state | Current `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`, and validator agree | **[Verified in source/test]** true before this discovery campaign; prompt authorizes docs-only work without changing campaign state |
| The app is offline-first | `validate-offline` passes for current source, SQLite is canonical, and export/import are local; current web export also succeeds | **[Verified]** offline architecture is real; actual device startup remains unobserved this session |
| “Neon Arcade” is the product identity | Current token comments and Campaign 026 history name that direction, but the actual palette is warm paper/deep plum with vermillion, semantic colors, and eight domain colors | **[Verified]** it is a design-system direction, not evidence that the product is perceived as an arcade; the redesign should test whether the label and simultaneous accents help the adult training premise |
| All 42 games are equally workout-eligible | `EXCLUDED_FROM_WORKOUT` excludes `language-word-match` while the generated catalog still contains 42 entries | **[Verified]** catalog breadth and daily-plan eligibility are intentionally different; the UI must explain or quietly handle the distinction |
| Green test/build records imply a green current release | Local source/test/export health is mostly green, but Expo Doctor fails and four current-head GitHub workflows failed immediately without steps/logs | **[Verified]** distinguish source correctness, packaging drift, and runner availability |
| A current runtime screenshot can settle the visual diagnosis | Dedicated AVD boot and QA all-mode both blocked | **[Verified]** source and prior artifacts support a structural diagnosis, but current screenshots and hands-on interaction remain a required follow-up |

## Root diagnosis (pre-redesign)

The largest problem is not that the app lacks features or a component system. It is that the product presents a mature engine as a set of simultaneous destinations, metrics, reward loops, and content shelves. The current route files make each job visible, but the composition does not yet force a clear priority.

1. **First-viewport hierarchy is overloaded. [Verified in source]** Home combines Today’s Workout, streak rhythm, at-risk state, level/XP/coins, rerolls, alternate workout templates/lengths, recent games, workout history, Spotlight, and mastery/milestones. Progress combines many valid analytical views into one long overview. Profile combines identity, streak tools, quests, achievements, cosmetics, rewards, data, theme, and sensory settings. **[Inferred]** the user must decide which system matters before they have completed the basic training action.
2. **Information architecture follows implementation ownership more than user intent. [Inferred]** Rich subsystems have visible cards where they are available, producing a “dashboard of systems” instead of a simple Today → Play → Understand loop. This is a composition problem, not an indictment of the subsystems.
3. **The current library is a catalog with discovery additions. [Verified in source]** Search, eight category filters, favorites, a featured hero, and three shelves all coexist above a 42-game grid. **[Inferred]** a player who knows the game can find it, but a player who wants “what should I do next?” has multiple recommendation surfaces to parse.
4. **Games share chrome more strongly than they express authored identity. [Verified in source]** GameHost standardizes the lifecycle and domain tint, while mechanics and copy differ materially. **[Inferred]** the redesign should preserve the shared contract and add lightweight authored identity at discovery/detail/intro boundaries, not turn every game into a separate mini-brand.
5. **Progress is analytically strong but explanation-heavy. [Verified in source]** It contains composite ratings, eight domains, activity, volume, PB history, comparisons, co-occurrence breadth, mastery insights, and drill-down routes. **[Inferred]** the first viewport should answer consistency, apparent training-performance movement, and next consideration; the existing depth should remain one or two taps away.
6. **Gamification has accumulated into parallel mental models. [Verified in source]** XP/level, coins, streak protection, quests, achievements, milestones, mastery, Spotlight, rerolls, rewards inbox, and cosmetics all have real code and persistence. **[Inferred]** the product needs a single motivation hierarchy and a unified “what can I do next?” treatment rather than more badges or currencies.
7. **Onboarding is an evidence gap. [Verified in source]** No dedicated onboarding route was found. **[Inferred]** a first-time user likely receives the same broad Home/new-player treatment as a returning user, although the exact first-launch rendering could not be observed. This must be tested before implementation.
8. **Runtime responsiveness and failure handling are architecturally considered but not current-head observed. [Verified in source]** bootstrap has recovery, game routes have error boundaries/Suspense, QA has deterministic budgets and status categories. **[Uncertain]** actual perceived load, scroll density, tutorial clarity, pause confidence, and tap ergonomics require a working emulator and human sessions.

## Strengths worth preserving

- **[Verified in source]** A real offline-first SQLite model with export/restore and destructive-action safeguards.
- **[Verified by test/CI]** Strong deterministic tests, registry/provenance/security/offline validators, and QA instrumentation.
- **[Verified in source]** 42 mechanically distinct games with versioned generators/scoring and a shared mandatory SDK.
- **[Verified in source]** Workout provenance, deterministic selection, resume, reroll accounting, and completion semantics.
- **[Verified in source]** GameHost/GameResults reuse, consistent pause/lifecycle behavior, and dev-only QA controls.
- **[Verified in source]** Tokenized light/dark themes, semantic/domain contrast families, stable test IDs, haptic/audio providers, and reusable UI primitives.
- **[Verified in source]** Data portability and explicit local-data ownership are unusually trustworthy product foundations.
- **[Historical]** Campaigns 023–028 show sustained work on gamification, shell modernization, board feedback, identity, reliability, and release evidence; the redesign should build on those seams rather than reopen their locked correctness decisions.

## High-value uncertainties for the next campaign

These are deliberately not filled with invented answers:

- **[Uncertain]** First-launch/new-player state, including whether a player understands why to start and whether a tutorial is discoverable without help.
- **[Uncertain]** Current visual hierarchy on a real small phone in light and dark themes.
- **[Uncertain]** Whether Home’s lower sections are meaningfully used or merely available.
- **[Uncertain]** Choice latency in Games and workout configuration.
- **[Uncertain]** Whether result stats are understood as personal-performance evidence rather than medical or intelligence claims.
- **[Uncertain]** Whether streak protection and coin/reroll costs feel motivating, punitive, or confusing.
- **[Uncertain]** iOS-specific native-tab and safe-area behavior.
- **[Uncertain]** The cause of current-head GitHub workflow failures; the API exposed no runner steps/logs, so no UX or CI code change is justified here.
