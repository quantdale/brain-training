# 011 — Shared Game Platform Primitives, Stable Lazy Loading, and Sensory Wiring

**Priority:** P2 / maintainability + correctness  
**Depends on:** 001; coordinate with 006 and 002  
**Primary surfaces:** shared game UI/platform components, registry generator, game route, sensory services/settings  
**Shared-file owner:** orchestrator

## Problems to correct

- Campaign 006 had to edit repeated `GameButton`, `PauseOverlay`, `QaPanel`, tutorial shells, and result-row patterns across many game modules. At 70+ future games, every cross-cutting fix becomes a catalog-wide conflict surface.
- The game route creates `lazy(loader)` during render, so lazy component identity is not guaranteed stable across rerenders.
- Audio/haptics interfaces exist, but game screens commonly invoke `noopAudioHaptics`; sensory settings are transient in-memory state. The product seam is more complete than the implementation.

The goal is **not** to centralize game mechanics. The goal is to centralize generic platform UI and services while preserving self-contained game logic.

## A. Shared game UI primitives

Create a small shared package/module under the mobile app for generic game chrome. Candidate primitives:

- `GameButton`
- `GamePauseOverlay`
- `GameQaPanelShell` / generic QA action buttons
- `GameTutorialFrame` (layout/step chrome, not mechanic-specific demo content)
- `GameResultStatRow`
- `GameDifficultySelector`
- `GameSessionHeader`
- shared loading/error card

Requirements:

- consume theme tokens/shared hooks;
- stable accessibility/testID semantics;
- memoization only where profiling/render behavior justifies it;
- no imports from a specific game module;
- no game-specific scoring/generator state inside shared primitives;
- allow custom children/labels so mechanics keep distinct identity.

Migrate incrementally. Avoid one giant component with dozens of conditional props.

### Duplication target

After convergence, a generic button/pause/result-row fix should normally touch one shared component, not 20 copies. Game-specific board/tile/card components remain local.

## B. Stable lazy game component identity

Lazy component creation must be cached outside the route render.

Recommended approaches:

1. generated registry exports stable `React.lazy(() => import(...))` component references; or
2. generated registry exports raw import loaders and a module-level cache maps game id -> lazy component exactly once.

The registry generator is authoritative. Do not hand-edit `registry.generated.ts` without updating the generator.

Required behavior:

- rerendering the route for the same game does not create a new lazy component identity/remount solely because the route rendered;
- changing game id intentionally resolves the new component;
- Suspense loading fallback remains stable;
- game error boundary can reset/retry deliberately.

Add a test that would fail if same-game route rerender remounts local game state because a new lazy component identity was created.

## C. Error boundary contract

Retain/improve the Campaign 006 route-level error boundary if correct.

Requirements:

- one game crashing does not crash the entire app shell;
- fallback identifies the game and offers Retry/Back;
- retry resets boundary state intentionally;
- structured diagnostic log includes game id, app/game version where available, component stack, and non-sensitive error message;
- error boundary is not used to swallow persistence failures that should be handled in normal state flow.

## D. Real audio/haptic service wiring

The game SDK interface remains the abstraction. Production screens should not directly call the no-op service unless sensory output is intentionally unavailable for that platform/build.

Required architecture:

- app-level `AudioHapticsProvider` or service supplies production implementation;
- implementation reads persisted global settings: SFX, music, haptics;
- game screens call the injected/shared service;
- muted/disabled modes become no-ops without changing gameplay;
- haptic/SFX failure never blocks gameplay;
- no audio is required to understand/complete a game.

Use current Expo-compatible official packages after checking the project's installed SDK compatibility at execution time. Do not add a dependency merely because the plan names an old package.

## E. Persist sensory settings

SFX/music/haptics settings must survive restart.

- persist via profile settings or a dedicated settings repository;
- updates must merge with theme/streak/tutorial keys safely;
- hydration occurs before/while provider initializes without visible incorrect toggling where practical;
- defaults remain sensible for first launch;
- future strong-particle/reduced-motion settings can use same seam later.

Background music itself may remain conservative/deferred; the persistence/service contract must be real.

## F. Audit mechanic duplication

Perform a catalog review, especially the three Memory sequence-like games:

- `memory`
- `memory-sequence-memory`
- `memory-pattern-tap-back`

Do not delete/redesign them in this spec unless a trivial correction is obvious. Produce a short recommendation in `.agent/KNOWN_ISSUES.md` or parity docs describing whether each is mechanically distinct enough.

Spec 013 decides whether any redundancy blocks completion.

For Pattern Tap Back, verify implementation/documentation alignment: if described as adjacency/random-walk/path memory, the generator must actually enforce that mechanic; otherwise rename/re-document or correct it in a separately owned game packet.

## Required tests

- shared primitive rendering/accessibility contract;
- production games compile after migration;
- same-game lazy route rerender preserves component identity/state;
- error boundary catches representative game render failure and retry works;
- sensory provider honors each toggle;
- settings persist across provider/app remount;
- disabled sensory services never alter reducer/game outcome;
- static scan or import rule verifies games do not import a production no-op directly except allowed test/fallback locations.

## MUST acceptance criteria

- Lazy game component identity is stable and generator-owned.
- Generic game UI duplication is materially reduced without centralizing mechanics.
- Production sensory service is wired through shared abstraction; no-op remains test/fallback only.
- Sensory preferences persist across restart.
- Error boundary behavior remains truthful and recoverable.
- Catalog mechanic-duplication audit is documented.
- Targeted tests, full suite, typecheck, registry check pass.

## Forbidden shortcuts

- Moving every game screen into a monolithic shared `GameScreen`.
- Using `React.memo` mechanically on every component without stable props/benefit.
- Caching lazy components in component state/effect after render rather than module/registry level.
- Making audio/haptics mandatory for gameplay.
- Persisting settings by overwriting unrelated `settings_json` keys.