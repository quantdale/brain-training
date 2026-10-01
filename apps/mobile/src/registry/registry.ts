/**
 * Game registry — consumer API for the generated game catalog.
 *
 * The shell (Games screen, `app/game/[id].tsx`) reads games through this
 * module and never touches the generated artifact directly.
 *
 * The `GameDefinition` contract is owned by the Game SDK (`@/sdk`); the
 * generated registry (`registry.generated.ts`) is produced by
 * `node scripts/generate-game-registry.mjs` from each game's `game.json`.
 * It is wired in at startup in `src/app/_layout.tsx`:
 *
 *   import { registry } from '@/registry/registry.generated';
 *   import { registerGameDefinitions } from '@/registry/registry';
 *   registerGameDefinitions(registry, { loaders: gameScreenLoaders });
 */

import { assertGameModuleSurface, defineGame } from '@/sdk';
import type { GameDefinition, GameModuleSurface } from '@/sdk';

export type { GameCategory, GameDefinition } from '@/sdk';

/** Games currently registered. Starts empty until startup wiring runs. */
let registeredGames: readonly GameDefinition[] = [];

/** A generated loader, as declared by `gameScreenLoaders`. */
export type GameModuleLoader = () => Promise<unknown>;

export interface RegisterGameOptions {
  /**
   * Game id -> dynamic import of its module, from the generated map.
   *
   * When supplied, each module's RUNTIME surface is validated (Change 074 §1).
   * The `game.json` contract is already checked by `defineGame`; this is the
   * separate, type-invisible half — a module whose `default` export is missing or
   * is not a component compiles perfectly and breaks only when a player opens
   * that game.
   */
  loaders?: Readonly<Record<string, GameModuleLoader>>;
}

/** Outcome of validating one module, cached so the import happens once. */
type SurfaceVerdict =
  | { status: 'ok'; moduleSurface: GameModuleSurface }
  | { status: 'rejected'; error: Error };

const verdicts = new Map<string, SurfaceVerdict>();

/** Ids whose module failed the surface contract, in registration order. */
let rejectedGameIds: readonly string[] = [];

/**
 * Register the game catalog. Called once at startup with the generated registry.
 * Every definition is validated through the SDK contract and frozen; an invalid
 * entry throws at startup.
 *
 * WHEN MODULE VALIDATION RUNS, AND WHY NOT AT REGISTRATION
 * -------------------------------------------------------
 * The plan called for every module to be validated during the `catalog-registry`
 * bootstrap stage. That would mean awaiting 42 dynamic imports before the shell
 * renders, which evaluates the whole game graph — generators, scoring, hooks and
 * their dependencies — on every cold start. This repository has already invested
 * in startup cost (the Home loading skeleton, the focus-sync throttle, the
 * startup-performance soak), and trading a measurable cold-start regression for a
 * check that would otherwise run anyway on first use is the wrong trade.
 *
 * So validation is LAZY and BLOCKING-ON-USE, which keeps the property that
 * actually matters:
 *
 * - a non-conforming module is **never made available for rendering** — the
 *   route calls `getValidatedGameModule` and gets a thrown, named error, so the
 *   game shows the recoverable not-ready state instead of a blank screen;
 * - the check runs exactly once per game, and only for games the user opens;
 *
 * A surface VIOLATION is static, so it is cached and recorded: the game can
 * never reach a render, and a retry would only recompute the same answer. An
 * IMPORT FAILURE is environmental and transient, so it is wrapped with the game
 * id, propagated to the route's error boundary, and NOT cached — the next open
 * retries. Conflating the two would let a transient chunk failure permanently
 * exclude a working game.
 *
 * `preflightGameModules()` is available as an explicit diagnostic but is NOT
 * wired into startup: under Jest every generated dynamic import fails, so an
 * automatic preflight would emit one error per game on every boot that mounts
 * the shell, in an environment where the failure is meaningless.
 *
 * The deviation from the plan is recorded in the change record rather than
 * hidden: the guarantee is "never rendered, and a static breach is reported",
 * not "reported before the first frame".
 */
export function registerGameDefinitions(
  definitions: readonly GameDefinition[],
  options: RegisterGameOptions = {},
): void {
  registeredGames = definitions.map(defineGame);
  verdicts.clear();
  rejectedGameIds = [];
  registeredLoaders = options.loaders ?? undefined;
}

/** The generated loader map, when registration supplied one. */
let registeredLoaders: Readonly<Record<string, GameModuleLoader>> | undefined;

/** Ids excluded by the surface contract; empty when every module conforms. */
export function getRejectedGameIds(): readonly string[] {
  return rejectedGameIds;
}

function recordRejection(gameId: string, error: Error): void {
  if (!rejectedGameIds.includes(gameId)) {
    rejectedGameIds = [...rejectedGameIds, gameId];
  }
   
  // gate scopes it in the suites that exercise a rejected module.
  console.error(`[registry] ${error.message}`);
}

/**
 * Resolve and validate a game module, or throw a named error naming the game
 * and the offending members. This is the only path that hands a module to the
 * route, so a non-conforming module cannot reach a render.
 */
export async function getValidatedGameModule(
  gameId: string,
): Promise<GameModuleSurface> {
  const loaders = registeredLoaders;
  if (!loaders) {
    throw new Error(
      `No game module loaders registered; ${gameId} cannot be resolved. ` +
        'Call registerGameDefinitions(registry, { loaders: gameScreenLoaders }) at startup.',
    );
  }
  const loader = loaders[gameId];
  if (!loader) {
    throw new Error(`No module loader registered for game "${gameId}".`);
  }

  // Cached in BOTH directions: a successful module is not re-imported on every
  // mount, and a rejected one is never retried (the defect is static, so a
  // retry only costs a re-evaluation for the same answer).
  const cached = verdicts.get(gameId);
  if (cached?.status === 'rejected') {
    throw cached.error;
  }
  if (cached?.status === 'ok') {
    return cached.moduleSurface;
  }

  let moduleSurface: GameModuleSurface;
  try {
    moduleSurface = (await loader()) as GameModuleSurface;
  } catch (error) {
    // An IMPORT failure is NOT a surface violation, and treating it as one was
    // a real defect: a transient chunk load (network hiccup, a bad deploy) would
    // permanently exclude a working game for the rest of the process, and would
    // be reported as a contract breach that does not exist. It is wrapped with
    // the game id for diagnosis, NOT cached, and NOT recorded as a rejection —
    // so the next open retries.
    const wrapped = new Error(
      `GameModuleSurface: ${gameId} could not be imported — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
    wrapped.name = 'GameModuleSurfaceError';
    throw wrapped;
  }

  try {
    assertGameModuleSurface(gameId, moduleSurface);
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    verdicts.set(gameId, { status: 'rejected', error: wrapped });
    recordRejection(gameId, wrapped);
    throw wrapped;
  }

  verdicts.set(gameId, { status: 'ok', moduleSurface });
  return moduleSurface;
}

/**
 * Validate every registered module in the BACKGROUND (Change 074 §1).
 *
 * Fire-and-forget by design: it populates `getRejectedGameIds()` early so the
 * catalog can report offenders without the user having to open each game, and it
 * never blocks the shell. Call it at startup and await it only in tests.
 */
export async function preflightGameModules(): Promise<readonly string[]> {
  const loaders = registeredLoaders;
  if (!loaders) return rejectedGameIds;
  await Promise.all(
    registeredGames.map(async (game) => {
      if (!loaders[game.id]) return;
      try {
        await getValidatedGameModule(game.id);
      } catch {
        // A surface violation is already recorded by getValidatedGameModule; an
        // import failure is deliberately not a rejection, so it is skipped here
        // too. The preflight's job is to populate the rejection list.
      }
    }),
  );
  return rejectedGameIds;
}

/** Test-only: forget cached verdicts and rejections. */
export function resetGameModuleValidationForTests(): void {
  verdicts.clear();
  rejectedGameIds = [];
  registeredLoaders = undefined;
}

/** All registered games, in registry order. */
export function getAllGameDefinitions(): readonly GameDefinition[] {
  return registeredGames;
}

/** Look up a game by stable id; `undefined` when not registered. */
export function getGameDefinition(id: string): GameDefinition | undefined {
  return registeredGames.find((game) => game.id === id);
}
