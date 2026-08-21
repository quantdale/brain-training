/**
 * Cross-game uniqueness + naming-convention contracts (campaign 011 — W06).
 *
 * The catalog only composes safely when its identity vocabulary is globally
 * unique and its module conventions are uniform:
 *
 *   - display `name`s must be unique (the player-facing library disambiguates
 *     by name, not by kebab-case id)
 *   - every game's `types.ts` exports GAME_ID equal to its directory name AND
 *     its registry id (three sources of truth in lockstep)
 *   - directory-name domain prefixes agree with `primaryCategory`
 *   - secondaryDomains never duplicate the primary category or themselves
 *   - difficulty modules follow one naming convention catalog-wide: exactly
 *     one `resolve<X>Difficulty`, exactly one `<x>ParamsFromProfile`, a
 *     `<x>ParamsForLevel` tuner, an ADAPTIVE_PARAMS record, a
 *     `<PREFIX>_DIFFICULTY_PARAMS` table, and a `sessionChallengeRating`
 *     adaptive-rating helper.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { registry } from '@/registry/registry.generated';

const GAMES_ROOT = join(__dirname, '..', '..', '..', 'games');

/**
 * jest's default CommonJS VM forbids true dynamic `import()`
 * (--experimental-vm-modules); requireActual resolves the SAME '@/…'
 * specifiers through the moduleNameMapper instead.
 */
function loadModule(specifier: string): Record<string, unknown> {
  return jest.requireActual(specifier) as Record<string, unknown>;
}


/** Directory prefix → expected primary category. Bare `memory` maps to Memory. */
const PREFIX_CATEGORY: ReadonlyArray<readonly [string, string]> = [
  ['attention-', 'Attention'],
  ['flexibility-', 'Flexibility'],
  ['language-', 'Language'],
  ['logic-', 'Logic & Problem Solving'],
  ['math-', 'Math'],
  ['memory-', 'Memory'],
  ['memory', 'Memory'],
  ['spatial-', 'Spatial'],
  ['speed-', 'Speed'],
];

describe('catalog-level uniqueness', () => {
  it('display names are unique across the registry', () => {
    const names = registry.map((game) => game.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every game ships a non-trivial description', () => {
    const shallow = registry.filter((game) => !game.description || game.description.length < 10);
    expect(shallow.map((game) => game.id)).toEqual([]);
  });

  it('secondaryDomains never repeat the primary category or themselves', () => {
    const problems = registry.flatMap((game) => {
      const domains = game.secondaryDomains ?? [];
      const issues: string[] = [];
      if (domains.includes(game.primaryCategory)) {
        issues.push(`${game.id}: secondaryDomains repeats primaryCategory "${game.primaryCategory}"`);
      }
      if (new Set(domains).size !== domains.length) {
        issues.push(`${game.id}: secondaryDomains contains duplicates`);
      }
      return issues;
    });
    expect(problems).toEqual([]);
  });

  it('directory prefixes agree with primaryCategory', () => {
    const mismatches = registry
      .filter((game) => {
        const entry = PREFIX_CATEGORY.find(([prefix]) => game.id.startsWith(prefix));
        return entry === undefined || entry[1] !== game.primaryCategory;
      })
      .map((game) => `${game.id} (${game.primaryCategory})`);
    expect(mismatches).toEqual([]);
  });
});

describe('GAME_ID identity lockstep', () => {
  it.each(registry.map((game) => game.id))(
    '%s: types.ts exports GAME_ID equal to directory and registry id',
    async (id) => {
      const mod = loadModule(`@/games/${id}/types`);
      expect(mod.GAME_ID).toBe(id);
    },
  );

  it('directory listing matches the registry exactly', () => {
    const dirs = readdirSync(GAMES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== '__tests__')
      .map((entry) => entry.name)
      .sort();
    expect(dirs).toEqual(registry.map((game) => game.id).sort());
  });
});

describe('difficulty module naming convention', () => {
  it.each(registry.map((game) => game.id))(
    '%s: exports the canonical difficulty-module surface',
    async (id) => {
      const mod = loadModule(`@/games/${id}/difficulty`);
      const keys = Object.keys(mod);

      const resolvers = keys.filter((key) => /^resolve[A-Za-z0-9]*Difficulty$/.test(key));
      expect(resolvers).toHaveLength(1);

      const decoders = keys.filter((key) => /^[A-Za-z0-9]*[Pp]aramsFromProfile$/.test(key));
      expect(decoders).toHaveLength(1);

      expect(keys.some((key) => /^[A-Za-z0-9]*[Pp]aramsForLevel$/.test(key))).toBe(true);
      expect(keys.some((key) => /(^|_)DIFFICULTY_PARAMS$/.test(key))).toBe(true);

      // Adaptive tuning is always an exported, frozen parameter record.
      expect(mod.ADAPTIVE_PARAMS).toBeDefined();
      expect(Object.isFrozen(mod.ADAPTIVE_PARAMS)).toBe(true);

      // Every game exposes the adaptive session-rating helper.
      expect(typeof mod.sessionChallengeRating).toBe('function');
    },
  );
});
