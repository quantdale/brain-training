/**
 * Runtime QA-gate + tutorial contracts for the NON-migrated games
 * (campaign 011 — W06).
 *
 * The 24 games that still carry their own screen (no `@/components/game-host`
 * delegation) own their session/QA/tutorial wiring inline, so the production
 * safety properties are verified here AT RUNTIME instead of by text scan:
 *
 *   - each game's `create<X>QaForceStateHooks` returns hooks bound to its
 *     GAME_ID whose every method REFUSES to run outside a dev build
 *     (`assertDevOnly`) — flipping `__DEV__` off must make force-win/lose/state
 *     throw before touching dispatch — and dispatches a QA action in dev builds;
 *   - each game's tutorial lifecycle factory yields the SDK lifecycle over an
 *     in-memory store: shows on first play, clears on complete, and its
 *     QA-bypass (`skipForQa`) is likewise dev-only;
 *   - the tutorial and QA-panel components exist as callable components and
 *     are actually wired into the screen source.
 *
 * Dangerous QA controls staying inert in production is constitution §29; this
 * suite is the regression net that keeps the 24 legacy screens honest while
 * they await GameHost migration.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const GAMES_ROOT = join(__dirname, '..', '..', '..', 'games');

/**
 * jest's default CommonJS VM forbids true dynamic `import()`
 * (--experimental-vm-modules); requireActual resolves the SAME '@/…'
 * specifiers through the moduleNameMapper instead.
 */
function loadModule(specifier: string): Record<string, unknown> {
  return jest.requireActual(specifier) as Record<string, unknown>;
}


/** Games whose screen.tsx does NOT delegate to the shared GameHost. */
function listNonMigratedGames(): string[] {
  return readdirSync(GAMES_ROOT)
    .filter((id) => {
      const screen = join(GAMES_ROOT, id, 'screen.tsx');
      try {
        return !readFileSync(screen, 'utf8').includes('@/components/game-host');
      } catch {
        return false;
      }
    })
    .sort();
}

const NON_MIGRATED = listNonMigratedGames();

/** Pinned at campaign-011 baseline; grows intentionally as migration lands. */
const EXPECTED_NON_MIGRATED_COUNT = 24;

interface QaHooks {
  readonly gameId: string;
  forceWin(): void;
  forceLose(): void;
  forceState?(patch: Readonly<Record<string, unknown>>): void;
}

type HooksFactory = (dispatch: unknown) => QaHooks;

function setDevBuild(dev: boolean): void {
  (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
}

function findExport(mod: Record<string, unknown>, pattern: RegExp): string {
  const matches = Object.keys(mod).filter((key) => pattern.test(key));
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe('non-migrated roster', () => {
  it('pins the count of screens awaiting GameHost migration', () => {
    expect(NON_MIGRATED).toHaveLength(EXPECTED_NON_MIGRATED_COUNT);
  });
});

describe('QA force-state hooks refuse to run outside dev builds', () => {
  let originalDev: boolean | undefined;

  beforeEach(() => {
    originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    setDevBuild(true);
  });

  afterEach(() => {
    setDevBuild(originalDev ?? true);
  });

  it.each(NON_MIGRATED)('%s: hooks gate on __DEV__ before dispatching', async (id) => {
    const mod = loadModule(`@/games/${id}/hooks`);
    const factoryName = findExport(mod, /^create[A-Za-z0-9]*QaForceStateHooks$/);
    const factory = mod[factoryName] as HooksFactory;

    const dispatch = jest.fn();
    const hooks = factory(dispatch);
    expect(hooks.gameId).toBe(id);

    // Production behavior: every method throws BEFORE reaching dispatch.
    setDevBuild(false);
    expect(() => hooks.forceWin()).toThrow(/dev-only/i);
    expect(() => hooks.forceLose()).toThrow(/dev-only/i);
    const forceState = hooks.forceState;
    if (typeof forceState === 'function') {
      expect(() => forceState({})).toThrow(/dev-only/i);
    }
    expect(dispatch).not.toHaveBeenCalled();

    // Dev behavior: force-win drives the reducer through a QA action.
    setDevBuild(true);
    hooks.forceWin();
    expect(dispatch).toHaveBeenCalled();
    const [action] = dispatch.mock.calls[0] as [{ type?: string } | undefined, ...unknown[]];
    expect(String(action?.type)).toContain('qa/');
  });
});

describe('tutorial lifecycle wiring', () => {
  let originalDev: boolean | undefined;

  beforeEach(() => {
    originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    setDevBuild(true);
  });

  afterEach(() => {
    setDevBuild(originalDev ?? true);
  });

  it.each(NON_MIGRATED)('%s: lifecycle shows first-play, completes, and skipForQa is dev-only', async (id) => {
    const mod = loadModule(`@/games/${id}/hooks`);
    const factoryName = findExport(mod, /^create[A-Za-z0-9]*TutorialLifecycle$/);
    const create = mod[factoryName] as () => {
      shouldShowTutorial(gameId: string): boolean;
      complete(gameId: string): void;
      skipForQa(gameId: string): void;
      getState(gameId: string): { completed: boolean };
    };

    const lifecycle = create();
    expect(lifecycle.shouldShowTutorial(id)).toBe(true);

    lifecycle.complete(id);
    expect(lifecycle.shouldShowTutorial(id)).toBe(false);
    expect(lifecycle.getState(id).completed).toBe(true);

    // The QA bypass shares the production gate with force-state hooks.
    setDevBuild(false);
    expect(() => lifecycle.skipForQa(id)).toThrow(/dev-only/i);
    setDevBuild(true);
    lifecycle.skipForQa(id);
  });
});

describe('tutorial + QA panel components exist and are wired into the screen', () => {
  it.each(NON_MIGRATED)('%s: components callable, screen mounts both', async (id) => {
    const tutorialMod = loadModule(`@/games/${id}/components/tutorial`);
    const tutorialComponent = Object.keys(tutorialMod).find(
      (key) =>
        (/(^|[^a-z])tutorial/i.test(key) || key === 'default') &&
        typeof tutorialMod[key] === 'function',
    );
    expect(`${id}: ${tutorialComponent ?? 'none'}`).not.toBe(`${id}: none`);

    const panelMod = loadModule(`@/games/${id}/components/qa-panel`);
    const panelComponent = Object.keys(panelMod).find(
      (key) =>
        (/qapanel/i.test(key) || key === 'default') &&
        typeof panelMod[key] === 'function',
    );
    expect(`${id}: ${panelComponent ?? 'none'}`).not.toBe(`${id}: none`);

    const screen = readFileSync(join(GAMES_ROOT, id, 'screen.tsx'), 'utf8');
    expect(screen).toContain('components/tutorial');
    expect(screen).toContain('components/qa-panel');
  });
});
