# Game SDK Contract — Bootstrap Requirements

**Status:** implemented as Phase 1 skeleton — see "Concrete TypeScript API — Phase 1 Skeleton" below for the live contracts (`apps/mobile/src/sdk/`). The requirements in this section remain binding.

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

# Concrete TypeScript API — Phase 1 Skeleton (SDK v0.1.0)

Implementation: `apps/mobile/src/sdk/` (public barrel `src/sdk/index.ts`, import as `@/sdk`).
This section supersedes the bootstrap requirements above with the concrete contracts; the requirements remain binding.

## Module map

| Module | Exports | Notes |
| --- | --- | --- |
| `version.ts` | `SDK_VERSION`, `RNG_ALGORITHM_VERSION` | `RNG_ALGORITHM_VERSION = 'mulberry32-v1'`; bump on RNG algorithm change |
| `rng.ts` | `createRng(seed)`, `normalizeSeed(seed)`, `Rng` | xmur3 → mulberry32; pure int32 math, cross-engine deterministic |
| `timing.ts` | `systemClock`, `createFakeClock(initialMs)`, `Stopwatch`, `Clock`, `FakeClock` | ms monotonic; `performance.now()` preferred |
| `lifecycle.ts` | `SessionLifecycle`, `IllegalTransitionError`, `SessionStatus` | `created → active → paused ⇄ active → completed \| abandoned`; pause freezes the active timer |
| `pause.ts` | `createPauseOverlaySpec(gameId)`, `PauseOverlaySpec` | Behavior spec: opaque, strong blur, challenge hidden |
| `audio-haptics.ts` | `liveAudioHaptics`, `getAudioHaptics`, `setLiveAudioHaptics`, `createNoopAudioHaptics`, `noopAudioHaptics`, `AudioHapticsService`, `FeedbackEvent`, `FEEDBACK_EVENTS`, `FEEDBACK_EVENT_MAP`, `SFX_ALIASES` | Dependency-free interface + no-op test double + live-service injection; `audio-haptics-real.ts` holds the real `expo-audio`/`expo-haptics` engine (`createAudioHaptics`) |
| `tutorial.ts` | `createTutorialLifecycle(store?)`, `createInMemoryTutorialStore()`, `TutorialLifecycle` | First-play/completion/replay/QA-skip; pluggable `TutorialStore` |
| `testid.ts` | `testId(gameId, ...elements)` | Stable semantic IDs, e.g. `memory-sequence.tile.3` |
| `types/game-definition.ts` | `GameDefinition`, `defineGame()`, `parseGameDefinitionJson()`, `GAME_CATEGORIES` | `game.json` → validated frozen `GameDefinition` (registry generator input) |
| `types/difficulty.ts` | `resolveDifficulty(level, params?)`, `DifficultyLevel`, `DifficultyProfile` | easy/normal/hard/expert/adaptive → challengeRating 0..1 + game parameters |
| `types/results.ts` | `PerformanceNormalizer`, `NormalizedPerformance`, `XpRatingHook`, `noopXpRatingHook` | Raw → normalized (0..1); XP/rating hooks are no-op until Phase 2 |
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

// Pause overlay MUST satisfy the spec: opaque + strong blur + challenge hidden.
const pause = createPauseOverlaySpec(gameId); // { opaque: true, strongBlur: true, hidesChallenge: true, testID: 'game.pause-overlay' }

// Results: game converts raw → normalized, then XP/rating hooks (no-op until Phase 2).
// Tutorial + audio/haptics are fire-and-forget services with pluggable stores.
```

## Reproducibility rule (binding)

Generated content is reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion, seed, difficulty)`. Games must persist these (see `DiagnosticMetadata`) with every completed session. Seeds are canonical strings: `createRng(42)` ≡ `createRng('42')`.

## Scoring pipeline (binding)

`raw result → PerformanceNormalizer.normalize() → NormalizedPerformance(0..1) → XpRatingHook` (real rating/XP algorithms land in Phase 2; `noopXpRatingHook` is the Phase 1 default).

## QA hooks (binding)

`QaForceStateHooks` (forceWin/forceLose/forceState) are dev-only: games gate them behind `isDevBuild()` and call `assertDevOnly()` inside each method. Production builds must not reference them.

## Registry integration

The orchestrator's registry generator reads each game's `game.json` and validates it via `parseGameDefinitionJson`; games never hand-edit a shared registry. The `db` layer implements `TutorialStore` to persist tutorial state; until then the in-memory store is used.
