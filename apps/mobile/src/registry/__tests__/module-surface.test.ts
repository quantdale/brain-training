/**
 * Game module surface validation (Change 074 §1).
 *
 * The gap this closes: `game.json` is validated through `defineGame` at
 * registration, but the module the generated loader actually imports and
 * renders is a RUNTIME fact no type check can see. A game could ship a perfect
 * definition and a module whose `default` export is missing, misspelled, or not
 * a component — it would compile, boot, and break only when a player opened
 * that game, as a blank screen or a crash inside React.
 */
import { describe, expect, it, beforeEach } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  assertGameModuleSurface,
  defineGame,
  GAME_MODULE_SURFACE_ERROR,
  GameModuleSurfaceError,
  inspectGameModuleSurface,
  REQUIRED_MODULE_MEMBERS,
  type GameDefinition,
  type GameModuleSurface,
} from '@/sdk';
import {
  getRejectedGameIds,
  getValidatedGameModule,
  preflightGameModules,
  registerGameDefinitions,
  resetGameModuleValidationForTests,
  type GameModuleLoader,
} from '@/registry/registry';
import { expectConsoleNoise } from '@/test-utils';
import { gameScreenLoaders, registry } from '@/registry/registry.generated';

function definitionFor(id: string): GameDefinition {
  return defineGame({
    id,
    name: `Game ${id}`,
    primaryCategory: 'Memory',
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    contentVersion: null,
    hasTutorial: false,
  });
}

/** A component stands in for a screen; the validator only asks "component-like". */
function FakeScreen(): null {
  return null;
}

const CONFORMING: GameModuleSurface = {
  default: FakeScreen,
  gameDefinition: definitionFor('memory'),
};

describe('module surface inspection (pure)', () => {
  it('accepts a conforming module', () => {
    expect(inspectGameModuleSurface('memory', CONFORMING)).toEqual({
      missing: [],
      problems: [],
    });
  });

  it('names every missing member', () => {
    const result = inspectGameModuleSurface('memory', {});
    expect(result.missing).toEqual([...REQUIRED_MODULE_MEMBERS]);
    expect([...REQUIRED_MODULE_MEMBERS]).toEqual(['default']);
  });

  it('names a MISSING default export', () => {
    // A module whose screen export was renamed: `defualt` instead of `default`.
    const result = inspectGameModuleSurface('memory', {
      defualt: FakeScreen,
      gameDefinition: definitionFor('memory'),
    });
    expect(result.missing).toEqual(['default']);
    expect(result.problems).toEqual([]);
  });

  it('does NOT require gameDefinition, because nothing in the host reads it', () => {
    // 074: an earlier draft required `gameDefinition` and every game module
    // would have been rejected over an export the host never consumes. The
    // requirement is narrowed to what is actually read.
    const result = inspectGameModuleSurface('memory', { default: FakeScreen });
    expect(result).toEqual({ missing: [], problems: [] });
  });

  it('still checks gameDefinition for id agreement WHEN it is present', () => {
    const result = inspectGameModuleSurface('memory', {
      default: FakeScreen,
      gameDefinition: definitionFor('speed-tap-rush'),
    });
    expect(result.missing).toEqual([]);
    expect(result.problems[0]).toMatch(/expected "memory"/);
  });

  it('rejects a default export that is not a component', () => {
    // Worse than missing: a present-but-wrong default renders and fails inside
    // React with a stack that points at React, not at the game.
    const result = inspectGameModuleSurface('memory', {
      default: 42,
      gameDefinition: definitionFor('memory'),
    });
    expect(result.missing).toEqual([]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/"default" is number, not a component/);
  });

  it('accepts a memo()/forwardRef() component object', () => {
    const memoLike = { $$typeof: Symbol.for('react.memo'), render: FakeScreen, type: null };
    expect(inspectGameModuleSurface('memory', {
      default: memoLike,
      gameDefinition: definitionFor('memory'),
    })).toEqual({ missing: [], problems: [] });
  });

  it('rejects a definition whose id disagrees with the directory', () => {
    const result = inspectGameModuleSurface('memory', {
      default: FakeScreen,
      gameDefinition: definitionFor('speed-tap-rush'),
    });
    expect(result.problems[0]).toMatch(/"gameDefinition.id" is "speed-tap-rush", expected "memory"/);
  });

  it('treats a null import as missing everything', () => {
    expect(inspectGameModuleSurface('memory', null).missing).toEqual([...REQUIRED_MODULE_MEMBERS]);
    expect(inspectGameModuleSurface('memory', undefined).problems[0]).toMatch(/resolved to nothing/);
  });

  it('throws a typed error naming the game and the members', () => {
    let thrown: unknown;
    try {
      assertGameModuleSurface('memory', {});
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(GameModuleSurfaceError);
    expect((thrown as GameModuleSurfaceError).name).toBe(GAME_MODULE_SURFACE_ERROR);
    expect((thrown as GameModuleSurfaceError).gameId).toBe('memory');
    expect((thrown as GameModuleSurfaceError).missing).toEqual([...REQUIRED_MODULE_MEMBERS]);
    expect((thrown as Error).message).toContain('memory');
    expect((thrown as Error).message).toContain('default');
  });
});

describe('registration-time validation (lazy, blocking on use)', () => {
  beforeEach(() => {
    resetGameModuleValidationForTests();
  });

  it('resolves a conforming module and caches the verdict', async () => {
    let calls = 0;
    const loader: GameModuleLoader = async () => {
      calls += 1;
      return CONFORMING;
    };
    registerGameDefinitions([definitionFor('memory')], { loaders: { memory: loader } });

    await expect(getValidatedGameModule('memory')).resolves.toBe(CONFORMING);
    // Cached: a second resolution must not re-import.
    await getValidatedGameModule('memory');
    expect(calls).toBe(1);
    expect(getRejectedGameIds()).toEqual([]);
  });

  it('refuses to hand back a module that is missing a member', async () => {
    const loader: GameModuleLoader = async () => ({ gameDefinition: definitionFor('memory') });
    registerGameDefinitions([definitionFor('memory')], { loaders: { memory: loader } });

    await expectConsoleNoise(/\[registry\].*does not satisfy the module contract/, async () => {
      await expect(getValidatedGameModule('memory')).rejects.toThrow(
        /GameModuleSurface: memory does not satisfy the module contract/,
      );
    });
    // ...and it is recorded, so the catalog can report it.
    expect(getRejectedGameIds()).toEqual(['memory']);
  });

  it('names a MISSING (misspelled) screen export specifically', async () => {
    const loader: GameModuleLoader = async () => ({
      defualt: FakeScreen, // the classic typo
      gameDefinition: definitionFor('memory'),
    });
    registerGameDefinitions([definitionFor('memory')], { loaders: { memory: loader } });

    await expectConsoleNoise(/\[registry\]/, async () => {
      await expect(getValidatedGameModule('memory')).rejects.toThrow(/missing or invalid: default/);
    });
  });

  it('caches a rejection so a second open does not retry the import', async () => {
    let calls = 0;
    const loader: GameModuleLoader = async () => {
      calls += 1;
      return {};
    };
    registerGameDefinitions([definitionFor('memory')], { loaders: { memory: loader } });

    await expectConsoleNoise(/\[registry\]/, async () => {
      await expect(getValidatedGameModule('memory')).rejects.toThrow();
    });
    // A rejected game is never made available for rendering, and retrying the
    // import on every mount would be a pointless cost for a static defect.
    await expect(getValidatedGameModule('memory')).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it('wraps an import failure with the game id and does NOT mark the game rejected', async () => {
    // 074: an import failure is environmental and transient (a chunk that did
    // not load), not a static contract breach. Recording it as a rejection would
    // permanently exclude a working game for the rest of the process and report
    // a defect that does not exist -- so it is wrapped for diagnosis, thrown to
    // the caller, and left uncached so the next open retries.
    const loader: GameModuleLoader = async () => {
      throw new Error('network chunk failed');
    };
    registerGameDefinitions([definitionFor('memory')], { loaders: { memory: loader } });

    await expect(getValidatedGameModule('memory')).rejects.toThrow(
      /GameModuleSurface: memory could not be imported — network chunk failed/,
    );
    expect(getRejectedGameIds()).toEqual([]);

    // Not cached: a second open retries rather than replaying a stale failure.
    let attempts = 0;
    const flaky: GameModuleLoader = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('transient');
      return CONFORMING;
    };
    registerGameDefinitions([definitionFor('memory')], { loaders: { memory: flaky } });
    await expect(getValidatedGameModule('memory')).rejects.toThrow(/transient/);
    await expect(getValidatedGameModule('memory')).resolves.toBe(CONFORMING);
    expect(attempts).toBe(2);
    expect(getRejectedGameIds()).toEqual([]);
  });

  it('reports an unregistered loader rather than rendering nothing', async () => {
    registerGameDefinitions([definitionFor('memory')], { loaders: {} });
    await expect(getValidatedGameModule('memory')).rejects.toThrow(
      /No module loader registered for game "memory"/,
    );
  });

  it('preflights every module and collects offenders without throwing', async () => {
    const loaders: Record<string, GameModuleLoader> = {
      memory: async () => CONFORMING,
      // A module whose screen export was renamed: the classic typo.
      'speed-tap-rush': async () => ({ defualt: FakeScreen }),
    };
    registerGameDefinitions(
      [definitionFor('memory'), definitionFor('speed-tap-rush')],
      { loaders },
    );

    await expectConsoleNoise(/\[registry\]/, async () => {
      // The preflight's contract: report, never throw — one broken game must not
      // take the other 41 offline.
      await expect(preflightGameModules()).resolves.toEqual(['speed-tap-rush']);
    });
    expect(getRejectedGameIds()).toEqual(['speed-tap-rush']);
  });
});

describe('the whole shipped catalog conforms (task 1.3)', () => {
  /**
   * The runtime preflight over all 42 real modules cannot run under Jest: the
   * generated loaders use `import('@/games/<id>')`, and this jest-expo setup
   * does not enable `--experimental-vm-modules`, so every dynamic import throws
   * "A dynamic import callback was invoked without --experimental-vm-modules"
   * before the module is evaluated. That is a HARNESS limitation, not a product
   * defect, and it is recorded rather than papered over.
   *
   * What CAN be verified here is the static half of the same contract: every
   * game module re-exports the members the validator requires. The runtime half
   * is exercised by `preflightGameModules()` at app startup, where the imports
   * resolve normally.
   */
  it('every game module re-exports the screen the host renders', () => {
    const gamesDir = resolve(__dirname, '..', '..', 'games');
    const gameIds = readdirSync(gamesDir)
      .filter((entry) => {
        try {
          return statSync(join(gamesDir, entry, 'index.ts')).isFile();
        } catch {
          return false;
        }
      })
      .sort();

    const problems: string[] = [];
    for (const id of gameIds) {
      const source = readFileSync(join(gamesDir, id, 'index.ts'), 'utf8');
      const hasDefault = /export\s*\{\s*default\s*\}/.test(source) || /export\s+default\b/.test(source);
      const hasDefinition = /export\s*\{[^}]*\bgameDefinition\b[^}]*\}/.test(source);
      if (!hasDefault) problems.push(`${id}: no "default" re-export`);
      if (!hasDefinition) problems.push(`${id}: no "gameDefinition" re-export`);
    }

    // The count is asserted so a scan that found nothing cannot pass.
    expect({ scanned: gameIds.length, problems }).toEqual({ scanned: 42, problems: [] });
  });

  it('the registry ships a loader for every registered game', () => {
    // The other half of the wiring: a game with no loader cannot be reached at
    // all, which the surface validator would otherwise never see.
    const missing = registry
      .map((game) => game.id)
      .filter((id) => !(id in gameScreenLoaders));
    expect({ checked: registry.length, missing }).toEqual({ checked: 42, missing: [] });
  });
});
