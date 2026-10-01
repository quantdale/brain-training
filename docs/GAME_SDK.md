# Game SDK Contract — Bootstrap Requirements

**Status:** implemented — see "Concrete TypeScript API" below for the live contracts (`apps/mobile/src/sdk/`), used by all 42 catalog games. The "Phase 1" label is historical; rating/progression shipped outside the SDK hook seam (see "Scoring pipeline"). The requirements in this section remain binding.

Every production game must integrate through the shared SDK rather than reinventing cross-cutting infrastructure.

## Required concepts

- stable game ID
- primary library category + optional secondary domains
- metadata/version
- player-facing named difficulty
- internal difficulty parameters/challenge rating
- deterministic seed/generator version
- session start/pause/resume/complete/abandon lifecycle
- monotonic/high-resolution timing service
- normalized score/result representation
- domain-rating contribution
- XP participation/performance contribution
- tutorial state/help
- audio/haptic hooks
- semantic automation IDs
- structured diagnostic metadata
- QA fixture/state forcing

## Persistence rule

Completed sessions must be atomically committed. Abandoned sessions do not update cognitive skill ratings and award no/negligible XP. Process-killed active sessions restart rather than requiring exact restoration.

## Pause rule

Pause freezes relevant timers and obscures challenge content behind a strong opaque blur/overlay.

## Generator rule

Procedural games must be reproducible by `(game version, generator version, seed, difficulty/config)` where practical.

## Scoring rule

A game owns raw scoring, then converts to a documented normalized performance representation before shared rating updates.

## Swarm rule

A game module should be independently implementable/testable by one coder packet without concurrent edits to other game modules. Shared registry/index changes should be generated or integrated by the orchestrator.

---

# Concrete TypeScript API (SDK v0.1.0; originally the Phase 1 skeleton)

Implementation: `apps/mobile/src/sdk/` (public barrel `src/sdk/index.ts`, import as `@/sdk`).
This section supersedes the bootstrap requirements above with the concrete contracts; the requirements remain binding.

## Module map

| Module | Exports | Notes |
| --- | --- | --- |
| `version.ts` | `SDK_VERSION`, `RNG_ALGORITHM_VERSION` | `RNG_ALGORITHM_VERSION = 'mulberry32-v1'`; bump on RNG algorithm change |
| `version-pack.ts` | `packVersion`, `unpackVersion`, `ABSENT_VERSION_NUMBER` | The ONE definition of how `major.minor.patch` becomes the `INTEGER NOT NULL` version column (constitution §21). Order-preserving; each component clamped to 0–999 so an overflow cannot reorder versions; an ABSENT version packs to `0` (sorts first) rather than throwing, because `GameDefinition.generatorVersion` is `string \| null` for non-procedural games. Replaces 42 per-game copies. |
| `rng.ts` | `createRng(seed)`, `normalizeSeed(seed)`, `Rng` | xmur3 → mulberry32; pure int32 math, cross-engine deterministic |
| `numeric.ts` | `clamp01`, `meanOf`, `bestOf`, `accuracyOf`, `meanSpeedOf`, … | Canonical math helpers. Single-sourced in Change 066 so 42 games cannot each round differently. |
| `exhaustive.ts` | `assertExhaustive` | Reducer exhaustiveness: passing the switch's residual action to this call is the compile-time ASSERTION, so an unhandled action stops the build and names the member. At runtime the branch is reachable only for a value outside the declared union, and it throws rather than silently returning state. |
| `module-surface.ts` | `assertGameModuleSurface`, `inspectGameModuleSurface`, `GameModuleSurfaceError`, `REQUIRED_MODULE_MEMBERS` | The RUNTIME half of a game module's contract. `game.json` is validated by `defineGame`; a module whose `default` export is missing or is not a component is invisible to `tsc` and breaks only when a player opens the game. Requires `default` (a component); `gameDefinition` is checked when present, and only for id agreement. |
| `perf.ts` | `markGameSessionStart`, `startPerfMeasure`, `PERF_EVENTS` | Dev-only marks/measures that open the latency windows the probes read; no-ops in release. |
| `timing.ts` | `systemClock`, `createFakeClock(initialMs)`, `Stopwatch`, `Clock`, `FakeClock` | ms monotonic; `performance.now()` preferred |
| `lifecycle.ts` | `SessionLifecycle`, `IllegalTransitionError`, `DuplicateSessionStartError`, `isTerminalSessionStatus`, `SessionStatus` | `created → active → paused ⇄ active → completed \| abandoned`; pause freezes the active timer. `isTerminalSessionStatus` is the shared answer to "can this session be discarded and replaced?"; `DuplicateSessionStartError` is what `useGameSession.begin()` throws for a second start while a session is still live (the host owns the lifecycle; a game must not reach around it). |
| `pause.ts` | `createPauseOverlaySpec(gameId)`, `PauseOverlaySpec` | Behavior spec: opaque, strong blur, challenge hidden |
| `audio-haptics.ts` | `liveAudioHaptics`, `getAudioHaptics`, `setLiveAudioHaptics`, `createNoopAudioHaptics`, `noopAudioHaptics`, `AudioHapticsService`, `FeedbackEvent`, `FEEDBACK_EVENTS`, `FEEDBACK_EVENT_MAP`, `SFX_ALIASES` | Dependency-free interface + no-op test double + live-service injection; `audio-haptics-real.ts` holds the real `expo-audio`/`expo-haptics` engine (`createAudioHaptics`) |
| `audio-haptics-real.ts` | `createAudioHaptics` | The REAL `expo-audio` / `expo-haptics` engine behind the `AudioHapticsService` interface. Kept separate from the dependency-free contract module so tests and the offline boundary never pull in a native dependency. |
| `tutorial.ts` | `createTutorialLifecycle(store?)`, `createInMemoryTutorialStore()`, `createWriteThroughTutorialStore(options)`, `TutorialLifecycle` | First-play/completion/replay/QA-skip; pluggable `TutorialStore`; write-through adapter bridges the sync SDK contract to the async `TutorialRepository` |
| `testid.ts` | `testId(gameId, ...elements)` | Stable semantic IDs, e.g. `memory-sequence.tile.3` |
| `types/game-definition.ts` | `GameDefinition`, `GameScreenProps`, `defineGame()`, `parseGameDefinitionJson()`, `GAME_CATEGORIES` | `game.json` → validated frozen `GameDefinition` (registry generator input). `GameScreenProps` declares the host-injected tutorial surface, so the GENERATED loader map carries the real screen prop type and the route needs no unchecked cast. |
| `types/difficulty.ts` | `resolveDifficulty(level, params?)`, `DifficultyLevel`, `DifficultyProfile` | easy/normal/hard/expert/adaptive → challengeRating 0..1 + game parameters |
| `types/results.ts` | `PerformanceNormalizer`, `NormalizedPerformance`, `XpRatingHook`, `noopXpRatingHook` | Raw → normalized (0..1); the SDK `XpRatingHook` seam is still a no-op — real rating/XP ships as the db-layer `RatingService` (`src/rating/**`, wired at app bootstrap) |
| `types/diagnostics.ts` | `createDiagnosticMetadata()`, `DiagnosticMetadata` | Versions, seed, difficulty, durations, generator info |
| `types/qa.ts` | `QaForceStateHooks`, `createNoopQaForceStateHooks()`, `isDevBuild()`, `assertDevOnly()` | Dev-only force win/lose/state; no-op safe default |

## Usage sketches

```ts
import {
  createRng, SessionLifecycle, resolveDifficulty, testId,
  createPauseOverlaySpec, noopAudioHaptics, createTutorialLifecycle,
  parseGameDefinitionJson, createDiagnosticMetadata,
} from '@/sdk';

// Deterministic generator (record seed + generatorVersion with results).
const rng = createRng('session-seed-42');
const layout = rng.shuffle(ids);
const child = rng.fork('distractors'); // independent deterministic stream

// Session lifecycle with injectable clock (tests pass a fake clock).
const lifecycle = new SessionLifecycle({ onStatusChange: (s, prev) => log(s, prev) });
lifecycle.start();
lifecycle.pause();  // freezes lifecycle.elapsedMs()
lifecycle.resume();
lifecycle.complete(); // or abandon(); both terminal

// Difficulty mapping (game supplies internal parameters).
const diff = resolveDifficulty('hard', { sequenceLength: 8, windowMs: 1500 });

// Pause overlay MUST satisfy the spec: opaque + challenge hidden (strongBlur is a decorative contract marker; the enforced anti-peek property is the opaque cover — constitution §11 allows "opaque blur/overlay").
const pause = createPauseOverlaySpec(gameId); // { opaque: true, strongBlur: true, hidesChallenge: true, testID: 'game.pause-overlay' }

// Results: game converts raw → normalized; the SDK hook seam stays no-op — the rating pipeline applies at session persistence (RatingService).
// Tutorial + audio/haptics are fire-and-forget services with pluggable stores.
```

## Reproducibility rule (binding)

Generated content is reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion, seed, difficulty)`. Games must persist these (see `DiagnosticMetadata`) with every completed session. Seeds are canonical strings: `createRng(42)` ≡ `createRng('42')`.

**The integer version columns are a SORTABLE INDEX, not the record of record.** `game_sessions.game_version` / `generator_version` / `scoring_version` are `INTEGER NOT NULL` and are produced by `packVersion` (`version-pack.ts`): `major*1e6 + minor*1e3 + patch`, each component clamped to 0–999 so the packing stays order-preserving and an out-of-range component cannot silently reorder versions. The full strings always travel with the raw result and the diagnostic metadata, so packing loses nothing — a version bump is always interpretable. An ABSENT version (`null`, which `GameDefinition` permits for non-procedural games) packs to `0`, which sorts below every real version; it does not throw, because the column is `NOT NULL` and throwing would crash the session-persist path the first time a genuinely non-procedural game shipped.

Games do not write this packing themselves: the per-game `versionToNumber` exports delegate to `packVersion`, so the encoding is defined once rather than 42 times. A malformed version string still throws rather than defaulting, because a silently-defaulted value is indistinguishable from another version.

## Scoring pipeline (binding)

`raw result → PerformanceNormalizer.normalize() → NormalizedPerformance(0..1) → RatingService at session persistence` (`db.completeSession`). The SDK's `XpRatingHook` remains a no-op default (`noopXpRatingHook`); the production XP/rating/currency math lives in `src/rating/**` (`createRatingPipeline`), and progression (quests/achievements/streaks/seeding) in `src/progression/**`.

## QA hooks (binding)

`QaForceStateHooks` (forceWin/forceLose/forceState) are dev-only: games gate them behind `isDevBuild()` and call `assertDevOnly()` inside each method. Production builds must not reference them.

## Registry integration

The orchestrator's registry generator reads each game's `game.json` and validates it via `parseGameDefinitionJson`; games never hand-edit a shared registry. The game route (`app/game/[id].tsx`) hydrates `createWriteThroughTutorialStore` from `getDb().tutorials` and injects it through each screen's `tutorialStore` prop, so first-play completion persists in `tutorial_state`; the in-memory store remains the fallback/default for isolated tests and when storage is unavailable.
