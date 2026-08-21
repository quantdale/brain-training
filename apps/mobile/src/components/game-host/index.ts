/**
 * @/components/game-host — shared game screen infrastructure (campaign 010,
 * architecture-debt D1).
 *
 * Consolidates the lifecycle/screen plumbing previously duplicated by every
 * game module (~36 copies of session id/seed creation, AppState auto-pause,
 * tutorial wiring, QA gating, intro/pause/results layout):
 *
 * - `useGameSession`: SDK `SessionLifecycle` ownership, collision-safe
 *   session ids, AppState auto-pause with frozen-clock resume, once-per-
 *   session finalization guard.
 * - `<GameHost>`: intro/difficulty/start layout, in-session header, dev-gated
 *   QA panel placement, opaque pause overlay mount, tutorial mount, results
 *   handoff, accessibility contract, Android hardware-back pause guard.
 * - `<GameResults>`: shared results chrome (headline/badges/stats/actions).
 * - `useGameInterval` / `useGameTimeout`: pause-aware pacing timers.
 * - `session-identity`: seed resolution + collision-safe session ids.
 *
 * Keep mechanics out: games own generator/reducer/scoring/view. The catalog
 * contract suite (`src/sdk/__tests__/catalog-contracts.test.ts`) recognizes
 * GameHost-based modules and enforces the same lifecycle/pause/QA invariants
 * over these shared sources.
 */

export { GameHost } from './game-host';
export type { GameHostProps, GameHostView } from './game-host';

export { GameResults } from './results';
export type { GameResultsProps, GameResultsPersistState } from './results';

export { useGameSession } from './use-game-session';
export type {
  GameSessionController,
  SessionStartIdentity,
  UseGameSessionOptions,
} from './use-game-session';

export { useGameInterval, useGameTimeout } from './timers';

export { createSessionId, randomSeed, resolveSessionSeed } from './session-identity';
