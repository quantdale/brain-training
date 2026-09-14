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
  /** Tutorial version for content tracking (null = not yet seen). */
  readonly version: string | null;
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
      states.set(gameId, { completed: state.completed, replayRequested: state.replayRequested, version: state.version });
    },
  };
}

/** Persistence callback for the write-through store (sync or async). */
export type TutorialPersist = (
  gameId: string,
  state: TutorialState,
) => void | Promise<void>;

export interface WriteThroughTutorialStoreOptions {
  /** Hydrated snapshot read from the durable store before first paint. */
  initial?: Readonly<Record<string, TutorialState>>;
  /** Durable sink, called in mutation order. */
  persist: TutorialPersist;
  /** Receives persistence failures; the local state stays as the player saw it. */
  onPersistError?: (gameId: string, error: unknown) => void;
}

/**
 * Synchronous `TutorialStore` over an async durable repository.
 *
 * The SDK contract is synchronous (game screens read tutorial state during
 * render), while the repository is async. This adapter starts from a hydrated
 * snapshot and queues every `setTutorialState` to `persist` in call order, so
 * reads always see the latest in-memory state and writes land in the same
 * order the player produced them. `flush()` resolves when every queued write
 * has settled; production does not depend on process death timing — a crash
 * before the SQLite commit leaves the tutorial un-completed, which is the
 * honest state (the write is replayed on the next completion).
 */
export interface WriteThroughTutorialStore extends TutorialStore {
  /** Resolves after every queued persistence write has settled. */
  flush(): Promise<void>;
}

export function createWriteThroughTutorialStore(
  options: WriteThroughTutorialStoreOptions,
): WriteThroughTutorialStore {
  const states = new Map<string, TutorialState>(Object.entries(options.initial ?? {}));
  let queue: Promise<void> = Promise.resolve();

  return {
    getTutorialState: (gameId) => states.get(gameId) ?? null,
    setTutorialState: (gameId, state) => {
      const snapshot: TutorialState = {
        completed: state.completed,
        replayRequested: state.replayRequested,
        version: state.version,
      };
      states.set(gameId, snapshot);
      queue = queue
        .then(() => options.persist(gameId, snapshot))
        .catch((error: unknown) => {
          options.onPersistError?.(gameId, error);
        });
    },
    flush: () => queue,
  };
}

const NOT_SEEN: TutorialState = Object.freeze({ completed: false, replayRequested: false, version: null });

/** Reference `TutorialLifecycle` over any `TutorialStore`. */
export function createTutorialLifecycle(store: TutorialStore = createInMemoryTutorialStore(), tutorialVersion: string = '1.0.0'): TutorialLifecycle {
  const stateFor = (gameId: string): TutorialState => store.getTutorialState(gameId) ?? NOT_SEEN;

  return {
    shouldShowTutorial: (gameId) => {
      const state = stateFor(gameId);
      // Show if never seen, or if version changed (new tutorial content), or replay requested
      return !state.completed || state.version !== tutorialVersion || state.replayRequested;
    },
    complete: (gameId) => {
      store.setTutorialState(gameId, { completed: true, replayRequested: false, version: tutorialVersion });
    },
    requestReplay: (gameId) => {
      const state = stateFor(gameId);
      store.setTutorialState(gameId, { completed: state.completed, replayRequested: true, version: state.version });
    },
    clearReplay: (gameId) => {
      const state = stateFor(gameId);
      store.setTutorialState(gameId, { completed: state.completed, replayRequested: false, version: state.version });
    },
    skipForQa: (gameId) => {
      assertDevOnly();
      store.setTutorialState(gameId, { completed: true, replayRequested: false, version: tutorialVersion });
    },
    getState: stateFor,
  };
}
