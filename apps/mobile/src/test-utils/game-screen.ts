/**
 * Shared seams for game-screen integration tests.
 *
 * Every game screen test needs the same three seams: a tutorial store
 * pre-marked as completed, a persistence spy standing in for the db layer,
 * and (see `clock.ts`) lockstep time control. These factories replace the
 * per-file copies of `completedStore()` / `makePersister()` previously
 * duplicated across all ~35 game screen tests; new tests should import them
 * from `@/test-utils` instead of re-declaring.
 *
 * The persister returns the full `CompleteSessionResult` shape (including the
 * null `rating` / `completionOutcome` branches) so screens exercising result
 * rendering see a faithful db-layer response, not a partial stub.
 */
import { jest } from '@jest/globals';
import { createInMemoryTutorialStore } from '@/sdk';
import type { TutorialStore } from '@/sdk';
import type {
  CompleteSessionInput,
  CompleteSessionResult,
} from '@/db';

/**
 * Persistence-seam shape shared by every game module's `SessionPersistence`
 * interface. Structurally assignable to each of them, without coupling this
 * helper to any single game's import graph.
 */
export interface SessionPersisterSpy {
  completeSession: jest.Mock<
    (input: CompleteSessionInput) => Promise<CompleteSessionResult>
  >;
}

/**
 * A `completeSession` spy that echoes the input session back with a neutral
 * outcome (no ledger entry, balance 0, no rating service). Pass `overrides`
 * to exercise specific result shapes (e.g. a rating outcome).
 */
export function makeSessionPersister(
  overrides: Partial<CompleteSessionResult> = {},
): SessionPersisterSpy {
  const completeSession = jest.fn(
    async (input: CompleteSessionInput): Promise<CompleteSessionResult> => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
      rating: null,
      completionOutcome: null,
      ...overrides,
    }),
  );
  return { completeSession };
}

/**
 * An in-memory tutorial store with `gameId` already marked completed, so the
 * screen renders its intro directly instead of the first-play tutorial.
 */
export function makeCompletedTutorialStore(
  gameId: string,
  version = '1.0.0',
): TutorialStore {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(gameId, {
    completed: true,
    replayRequested: false,
    version,
  });
  return store;
}
