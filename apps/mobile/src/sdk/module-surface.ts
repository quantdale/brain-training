/**
 * Game module surface validation (Change 074 §1).
 *
 * WHAT THIS GUARDS
 * -----------------
 * `GameDefinition` (from `game.json`) is validated today, but the RUNTIME
 * module surface — the object the generated `gameScreenLoaders` map actually
 * imports and renders — is not. The two can disagree: a game can ship a perfect
 * `game.json` and a module whose default export is missing, is not a
 * component, or is a component with the wrong props. Nothing catches that at
 * boot. The failure surfaces when a player opens that game, as a blank screen or
 * a crash deep inside React, long after the app looked healthy.
 *
 * The surface is small and explicit because it is what the host ACTUALLY
 * depends on, and that was measured rather than assumed. A first draft of this
 * validator also required `gameDefinition`; a repo-wide search showed nothing
 * outside `src/games/` ever reads a module's `gameDefinition` — the catalog
 * comes from `game.json` through the generated registry. Requiring it would
 * have rejected games over an export nobody uses, which is precisely the
 * failure mode this module warns about in its own docstring.
 *
 * So the contract is exactly:
 *
 *   - `default` — the screen component the route renders. Without it (or with
 *     something that is not a component) the route falls through to
 *     `GameNotReady`, which reads as "not implemented" for a game that IS
 *     shipped, and a non-component `default` instead renders and then fails
 *     inside React with a stack pointing at React rather than at the game.
 *
 * `gameDefinition` is checked ONLY when present, and only for id agreement with
 * the directory. That catches a module whose definition drifted from its
 * game.json without making an unused export mandatory.
 *
 * WHY IT FAILS AT BOOT RATHER THAN AT USE
 * -----------------------------------------
 * `catalog-registry` is a FOUNDATIONAL bootstrap stage, so a thrown error here
 * produces the `recovery-required` outcome — a named, retryable screen — rather
 * than a shell that appears healthy and breaks later on one game.
 */

import type { GameDefinition, GameScreenProps } from './types/game-definition';

/** A module as the host actually receives it, after a dynamic `import()`. */
export type GameModuleSurface = {
  default?: unknown;
  gameDefinition?: unknown;
  [key: string]: unknown;
};

/** The members the host depends on, in the order the message lists them. */
export const REQUIRED_MODULE_MEMBERS = ['default'] as const;

/** The error thrown for a non-conforming module. Named so callers can classify. */
export const GAME_MODULE_SURFACE_ERROR = 'GameModuleSurfaceError';

export class GameModuleSurfaceError extends Error {
  readonly gameId: string;
  readonly missing: readonly string[];

  constructor(gameId: string, missing: readonly string[], problems: readonly string[]) {
    const detail = problems.length > 0 ? ` (${problems.join('; ')})` : '';
    super(
      `GameModuleSurface: ${gameId} does not satisfy the module contract — ` +
        `missing or invalid: ${missing.join(', ')}${detail}. ` +
        `The host needs ${REQUIRED_MODULE_MEMBERS.join(' and ')} on the module's default export path.`,
    );
    this.name = GAME_MODULE_SURFACE_ERROR;
    this.gameId = gameId;
    this.missing = missing;
  }
}

/** Is this a renderable component? */
function isComponentLike(value: unknown): boolean {
  if (typeof value === 'function') {
    // A plain function is a component; class components are functions too.
    return true;
  }
  // memo()/forwardRef() objects carry `$$typeof` and a `render`.
  if (typeof value === 'object' && value !== null) {
    const record = value as { $$typeof?: unknown; render?: unknown };
    return typeof record.render === 'function' || record.$$typeof !== undefined;
  }
  return false;
}

function isFrozenDefinition(value: unknown): value is GameDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

/**
 * Pure surface check. Returns the failures rather than throwing, so the caller
 * controls the error boundary and a caller that only wants to REPORT (the
 * catalog test) does not have to catch.
 */
export function inspectGameModuleSurface(
  gameId: string,
  moduleSurface: GameModuleSurface | null | undefined,
): { missing: string[]; problems: string[] } {
  const missing: string[] = [];
  const problems: string[] = [];

  if (moduleSurface === null || moduleSurface === undefined) {
    return {
      missing: [...REQUIRED_MODULE_MEMBERS],
      problems: ['the dynamic import resolved to nothing'],
    };
  }

  const screen = moduleSurface.default;
  if (screen === undefined) {
    missing.push('default');
  } else if (!isComponentLike(screen)) {
    // A `default` that is not a component is worse than a missing one: the
    // route would render it and fail inside React with an error whose stack
    // points at React, not at the game.
    problems.push(`"default" is ${typeof screen}, not a component`);
  }

  // Optional member, checked only when present. The directory name, the
  // game.json id and a module's own definition must agree, or QA and the
  // registry disagree about which game is which — but its absence is not a
  // breach, because nothing in the host reads it.
  const definition = moduleSurface.gameDefinition;
  if (definition !== undefined) {
    if (!isFrozenDefinition(definition)) {
      problems.push('"gameDefinition" is present but is not a game definition object');
    } else if (definition.id !== gameId) {
      problems.push(`"gameDefinition.id" is "${definition.id}", expected "${gameId}"`);
    }
  }

  return { missing, problems };
}

/**
 * Validate a game module's runtime surface, throwing a typed error naming the
 * module and every missing member. Call this from the registration path so a
 * non-conforming module fails fast at boot.
 *
 * `GameScreenProps` is referenced in the signature's documentation rather than
 * the parameter type on purpose: the props a screen accepts are a TYPE-level
 * contract the compiler already checks, while this function guards the
 * RUNTIME members, which `tsc` cannot see.
 */
export function assertGameModuleSurface(
  gameId: string,
  moduleSurface: GameModuleSurface | null | undefined,
): asserts moduleSurface is GameModuleSurface {
  const { missing, problems } = inspectGameModuleSurface(gameId, moduleSurface);
  if (missing.length > 0 || problems.length > 0) {
    throw new GameModuleSurfaceError(gameId, missing, problems);
  }
}

/** The prop contract a validated screen is expected to accept. */
export type ValidatedScreenProps = GameScreenProps;
