/**
 * QA force-state hooks contract (constitution §29: "Dangerous QA hooks are
 * unavailable in production builds"; §11 QA instrumentation requirements:
 * fast force-win/force-lose paths where safe).
 *
 * Games implement `QaForceStateHooks` and expose them ONLY in dev builds
 * (e.g. behind `isDevBuild()`); the shared default is a no-op that throws
 * outside dev builds. Production builds must never reference these hooks.
 */
/**
 * True in development builds. `__DEV__` is provided by the React Native
 * runtime and is `false` in release builds.
 */
export function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}

/** Guard for dev-only hooks: throws when invoked outside a dev build. */
export function assertDevOnly(): void {
  if (!isDevBuild()) {
    throw new Error('QA force-state hooks are dev-only and must not run in production builds.');
  }
}

/**
 * Typed interface games implement to force QA states. All methods are
 * dev-only; games should call `assertDevOnly()` at the top of each method.
 */
export interface QaForceStateHooks {
  readonly gameId: string;
  /** Force an immediate win/completion of the current session. */
  forceWin(): void;
  /** Force an immediate loss/failure of the current session. */
  forceLose(): void;
  /** Optional: apply an arbitrary typed state patch (game-defined keys). */
  forceState?(patch: Readonly<Record<string, unknown>>): void;
}

/**
 * Safe default: does nothing (and refuses to run in production builds).
 * Games use this until they implement real hooks.
 */
export function createNoopQaForceStateHooks(gameId: string): QaForceStateHooks {
  return {
    gameId,
    forceWin: () => {
      assertDevOnly();
    },
    forceLose: () => {
      assertDevOnly();
    },
    forceState: () => {
      assertDevOnly();
    },
  };
}
