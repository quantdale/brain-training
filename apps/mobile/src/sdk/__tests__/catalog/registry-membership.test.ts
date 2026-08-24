/**
 * Catalog-wide registry-membership contracts (campaign 011 — W06).
 *
 * Unlike `src/sdk/__tests__/catalog-contracts.test.ts` (which scans game
 * sources as PLAIN TEXT), this suite is driven by the GENERATED registry
 * (`@/registry/registry.generated`) and actually IMPORTS each game module,
 * enforcing at runtime what the text scans can only approximate:
 *
 *   - registry ↔ directory ↔ on-disk `game.json` agreement (staleness guard
 *     for the generated artifact: if a game.json changes without regenerating,
 *     the embedded metadata diverges and fails here)
 *   - required-file presence per module (incl. components every screen mounts)
 *   - export shape: lazy loader resolves to a renderable default component and
 *     a frozen `gameDefinition` that deep-equals the SDK-parsed registry entry
 *   - version coherence: every declared version parses as semver, sdkVersion
 *     matches the current SDK, scoring versions pack into safe integers via
 *     the db's integer version columns (`versionToNumber`)
 *   - adaptive-difficulty decode STRICTNESS: every game resolves all five
 *     levels into valid profiles (fixed levels keep the SDK baseline ratings;
 *     `adaptive` starts at the 0.5 neutral baseline) and its strict
 *     `<x>ParamsFromProfile` decoder round-trips its own profiles while
 *     REJECTING an empty parameter record instead of silently producing a
 *     broken tuning.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ADAPTIVE_BASELINE,
  CURRENT_SDK_VERSION,
  DEFAULT_CHALLENGE_RATINGS,
  DIFFICULTY_LEVELS,
} from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';
import { parseGameDefinitionJson } from '@/sdk/types/game-definition';

import { gameScreenLoaders, registry } from '@/registry/registry.generated';

/** apps/mobile/src/games — resolved relative to this file (.../sdk/__tests__/catalog). */
const GAMES_ROOT = join(__dirname, '..', '..', '..', 'games');

/**
 * Catalog size pinned at the campaign-011 baseline (42 games). Intentional
 * catalog growth updates this constant as part of the change; accidental
 * directory loss or a broken scan fails loudly here.
 */
const EXPECTED_GAME_COUNT = 42;

/** Files every self-contained game module must ship (constitution §11 layout). */
const REQUIRED_FILES = [
  'game.json',
  'index.ts',
  'screen.tsx',
  'game-definition.ts',
  'types.ts',
  'difficulty.ts',
  'generator.ts',
  'scoring.ts',
  'reducer.ts',
  'session.ts',
  'versions.ts',
  'hooks.ts',
  'components/tutorial.tsx',
  'components/qa-panel.tsx',
] as const;

/**
 * Load a game module through jest's CJS resolver. The default jest VM forbids
 * true dynamic `import()` (needs --experimental-vm-modules), so the suites
 * resolve the SAME '@/games/<id>' specifiers the generated loaders use via
 * `requireActual`; loader-function identity itself is asserted structurally
 * (key parity) since invoking it is an app-runtime concern.
 */
function loadModule(specifier: string): Record<string, unknown> {
  return jest.requireActual(specifier) as Record<string, unknown>;
}

/** Asserts `<label>=<semver>` so failures name the offending field. */
function expectSemver(value: string | null | undefined, label: string): void {
  expect(`${label}=${value ?? 'undefined'}`).toMatch(new RegExp(`^${label}=\\d+\\.\\d+\\.\\d+$`));
}

describe('registry sanity', () => {
  it('pins the campaign-011 catalog size', () => {
    expect(registry).toHaveLength(EXPECTED_GAME_COUNT);
  });

  it('ids are unique and sorted ascending (deterministic generator output)', () => {
    const ids = registry.map((game) => game.id);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gameScreenLoaders covers exactly the registry ids', () => {
    const loaderIds = Object.keys(gameScreenLoaders).sort();
    expect(loaderIds).toEqual(registry.map((game) => game.id).sort());
  });
});

describe('per-game structural contracts', () => {
  it.each(registry.map((game) => [game.id, game] as const))(
    '%s: directory, required files, and game.json ↔ registry agreement',
    (id, entry) => {
      const dir = join(GAMES_ROOT, id);
      expect(existsSync(dir)).toBe(true);

      const missing = REQUIRED_FILES.filter((file) => !existsSync(join(dir, file)));
      expect(missing).toEqual([]);

      // Staleness guard for the generated registry: the embedded metadata must
      // still deep-equal the on-disk game.json it was generated from.
      const rawJson = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8')) as unknown;
      const parsed = parseGameDefinitionJson(rawJson);
      expect(parsed).toEqual(parseGameDefinitionJson({ ...entry }));
    },
  );

  it.each(registry.map((game) => [game.id, game] as const))(
    '%s: version fields are coherent semver',
    async (_id, entry) => {
      expectSemver(entry.sdkVersion, 'sdkVersion');
      expectSemver(entry.gameVersion, 'gameVersion');
      expect(entry.sdkVersion).toBe(CURRENT_SDK_VERSION);
      if (entry.generatorVersion !== null) {
        expectSemver(entry.generatorVersion, 'generatorVersion');
      }
      if (entry.contentVersion !== null) {
        expectSemver(entry.contentVersion, 'contentVersion');
      }

      const scoring = readFileSync(join(GAMES_ROOT, entry.id, 'versions.ts'), 'utf8');
      const match = /SCORING_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/.exec(scoring);
      expect(match).not.toBeNull();
      const scoringVersion = match?.[1] ?? '';

      // The db stores integer version columns packed by versionToNumber; every
      // declared version must survive the packing inside the safe-integer range.
      const versions = loadModule(`@/games/${entry.id}/versions`) as unknown as {
        versionToNumber: (version: string | null) => number;
      };
      for (const version of [entry.gameVersion, scoringVersion]) {
        const packed = versions.versionToNumber(version);
        expect(Number.isSafeInteger(packed)).toBe(true);
        expect(packed).toBeGreaterThan(0);
      }
    },
  );
});

describe('module export shape (lazy loader contract)', () => {
  it.each(registry.map((game) => game.id))(
    '%s: loader resolves to a default component + frozen gameDefinition',
    (id) => {
      const loader = gameScreenLoaders[id];
      expect(typeof loader).toBe('function');
      // Same specifier the generated loader statically imports; invoked via
      // jest's CJS resolver because the default VM forbids dynamic import().
      const mod = loadModule(`@/games/${id}`);

      // Default export is the screen: a function component/class, or a React
      // memo/forwardRef wrapper object carrying a $$typeof symbol.
      const component = mod.default;
      const isRenderable =
        typeof component === 'function' ||
        (typeof component === 'object' &&
          component !== null &&
          '$$typeof' in (component as Record<string, unknown>));
      expect(isRenderable).toBe(true);

      const definition = mod.gameDefinition as Record<string, unknown> | undefined;
      expect(definition).toBeDefined();
      expect(Object.isFrozen(definition)).toBe(true);
      // Normalized equality through the SDK parser on both sides so cosmetic
      // serialization differences (e.g. dropped empty secondaryDomains) agree.
      expect(definition).toEqual(parseGameDefinitionJson({ ...registry.find((g) => g.id === id) }));
    },
  );
});

describe('adaptive difficulty resolve + decode strictness', () => {
  /** An empty-parameter profile: strict decoders must refuse it loudly. */
  const EMPTY_ADAPTIVE_PROFILE: DifficultyProfile = {
    level: 'adaptive',
    challengeRating: ADAPTIVE_BASELINE.challengeRating,
    parameters: {},
  };

  it.each(registry.map((game) => game.id))(
    '%s: resolves all five levels; decoder round-trips and rejects empty params',
    (id) => {
      const mod = loadModule(`@/games/${id}/difficulty`);

      const resolvers = Object.keys(mod).filter((key) => /^resolve[A-Za-z0-9]*Difficulty$/.test(key));
      expect(resolvers).toHaveLength(1);
      const resolve = mod[resolvers[0]] as (level: DifficultyLevel) => DifficultyProfile;

      const decoders = Object.keys(mod).filter((key) => /^[A-Za-z0-9]*[Pp]aramsFromProfile$/.test(key));
      expect(decoders).toHaveLength(1);
      const decode = mod[decoders[0]] as (profile: DifficultyProfile) => Record<string, number>;

      for (const level of DIFFICULTY_LEVELS) {
        const profile = resolve(level);
        expect(profile.level).toBe(level);
        expect(Number.isFinite(profile.challengeRating)).toBe(true);
        expect(profile.challengeRating).toBeGreaterThanOrEqual(0);
        expect(profile.challengeRating).toBeLessThanOrEqual(1);
        for (const value of Object.values(profile.parameters)) {
          expect(typeof value === 'number' && Number.isFinite(value)).toBe(true);
        }

        if (level === 'adaptive') {
          // Adaptive starts at the SDK neutral baseline; games adjust during play.
          expect(profile.challengeRating).toBe(ADAPTIVE_BASELINE.challengeRating);
        } else {
          expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
        }

        // Round-trip: the game's own decoder accepts its own resolved profile.
        // Decoded GAME params may be rich (e.g. prompt-type arrays decoded from
        // a numeric mask), so only require a non-empty tuning object here; the
        // finite-number invariant applies to the profile record itself above.
        const decoded = decode(profile);
        expect(Object.keys(decoded).length).toBeGreaterThan(0);
      }

      // Strictness: decoding a profile without parameters must throw rather
      // than silently producing broken gameplay tuning.
      expect(() => decode(EMPTY_ADAPTIVE_PROFILE)).toThrow();
    },
  );
});
