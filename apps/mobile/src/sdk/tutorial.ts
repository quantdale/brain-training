/**
 * Tutorial lifecycle contract (constitution §12: first play shows a short
 * interactive tutorial, skipped after completion but replayable from
 * help/info; QA can bypass tutorials instantly).
 *
 * Reference implementation is in-memory; persistence wiring into the db
 * packet happens via the pluggable `TutorialStore` (the db module can
 * implement it without touching this file).
 */
import { assertDevOnly } from './types/qa';

export interface TutorialState {
  /** Tutorial finished (or QA-skipped). */
  readonly completed: boolean;
  /** Player requested a replay from help/info. */
  readonly replayRequested: boolean;
}

/** Minimal persistence seam; the db layer implements this in Phase 1+. */
export interface TutorialStore {
  getTutorialState(gameId: string): TutorialState | null;
  setTutorialState(gameId: string, state: TutorialState): void;
}

export interface TutorialLifecycle {
  /** True when the tutorial should show (first play or replay requested). */
  shouldShowTutorial(gameId: string): boolean;
  /** Mark the tutorial completed for this game; clears any pending replay. */
  complete(gameId: string): void;
  /** Request a replay; the tutorial shows again on the next play. */
  requestReplay(gameId: string): void;
  /** Clear a pending replay without marking completion. */
  clearReplay(gameId: string): void;
  /** QA-only: mark completed without playing the tutorial. Throws outside dev builds. */
  skipForQa(gameId: string): void;
  getState(gameId: string): TutorialState;
}

/** Default in-memory store (map-backed). */
export function createInMemoryTutorialStore(): TutorialStore {
  const states = new Map<string, TutorialState>();
  return {
    getTutorialState: (gameId) => states.get(gameId) ?? null,
    setTutorialState: (gameId, state) => {
      states.set(gameId, { completed: state.completed, replayRequested: state.replayRequested });
    },
  };
}

const NOT_SEEN: TutorialState = Object.freeze({ completed: false, replayRequested: false });

/** Reference `TutorialLifecycle` over any `TutorialStore`. */
export function createTutorialLifecycle(store: TutorialStore = createInMemoryTutorialStore()): TutorialLifecycle {
  const stateFor = (gameId: string): TutorialState => store.getTutorialState(gameId) ?? NOT_SEEN;

  return {
    shouldShowTutorial: (gameId) => {
      const state = stateFor(gameId);
      return !state.completed || state.replayRequested;
    },
    complete: (gameId) => {
      store.setTutorialState(gameId, { completed: true, replayRequested: false });
    },
    requestReplay: (gameId) => {
      const state = stateFor(gameId);
      store.setTutorialState(gameId, { completed: state.completed, replayRequested: true });
    },
    clearReplay: (gameId) => {
      const state = stateFor(gameId);
      store.setTutorialState(gameId, { completed: state.completed, replayRequested: false });
    },
    skipForQa: (gameId) => {
      assertDevOnly();
      store.setTutorialState(gameId, { completed: true, replayRequested: false });
    },
    getState: stateFor,
  };
}
