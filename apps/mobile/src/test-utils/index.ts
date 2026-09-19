/**
 * Deterministic test-fixture infrastructure (shared, test-only).
 *
 * Import from `@/test-utils` in tests. Contents:
 * - `advanceTime(clock, ms)` — lockstep FakeClock + jest fake timers advance
 *   (see `clock.ts`; requires `jest.useFakeTimers()`).
 * - `drawUniqueInts` / `seededFloats` — seeded sampling helpers (`rng.ts`).
 * - `createMigratedDb` — fresh in-memory migrated DB (`db.ts`).
 * - `makeSessionRecord`, `FIXED_TEST_NOW` — deterministic record factories
 *   (`fixtures.ts`).
 * - `makeSessionPersister`, `makeCompletedTutorialStore` — game-screen seams
 *   (`game-screen.ts`).
 * - `withBootstrapContract` — wraps a partial fake db so the classified
 *   bootstrap pipeline can complete (`bootstrap-db.ts`).
 *
 * Rules for this directory: helpers must stay deterministic (no wall-clock,
 * no `Math.random()`) and must never be imported by product code.
 */
export { advanceTime } from './clock';
export { drawUniqueInts, seededFloats } from './rng';
export { createMigratedDb } from './db';
export { FIXED_TEST_NOW, makeSessionRecord } from './fixtures';
export {
  makeCompletedTutorialStore,
  makeSessionPersister,
} from './game-screen';
export type { SessionPersisterSpy } from './game-screen';
export { withBootstrapContract } from './bootstrap-db';
export type { PartialAppDatabase } from './bootstrap-db';
export { ROOT_LAYOUT_ROUTE_NAMES, rootLayoutRoutes } from './root-layout-routes';
export {
  assertNoUnexpectedConsoleOutput,
  expectConsoleNoise,
  installConsoleSignalGuard,
  resetConsoleSignal,
} from './console-signal';
export type { ConsoleBaselineEntry } from './console-signal';
