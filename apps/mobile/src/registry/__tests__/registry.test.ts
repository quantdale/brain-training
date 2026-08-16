/**
 * Registry consumer tests — empty state by default, registration, lookup.
 * (The generated `registry.generated.ts` is orchestrator-owned and not
 * required for these tests.)
 */

// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  getAllGameDefinitions,
  getGameDefinition,
  registerGameDefinitions,
} from '@/registry/registry';
import { GAME_CATEGORIES } from '@/sdk';
import type { GameDefinition } from '@/sdk';

const SAMPLE_GAMES: GameDefinition[] = [
  {
    id: 'memory-match',
    name: 'Memory Match',
    primaryCategory: 'Memory',
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: '1',
    hasTutorial: true,
  },
  {
    id: 'quick-arithmetic',
    name: 'Quick Arithmetic',
    primaryCategory: 'Math',
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: '1',
    hasTutorial: false,
  },
];

describe('game registry', () => {
  beforeEach(() => {
    registerGameDefinitions([]);
  });

  it('starts empty until games register', () => {
    expect(getAllGameDefinitions()).toEqual([]);
    expect(getGameDefinition('anything')).toBeUndefined();
  });

  it('returns registered games in order', () => {
    registerGameDefinitions(SAMPLE_GAMES);
    expect(getAllGameDefinitions().map((g) => g.id)).toEqual([
      'memory-match',
      'quick-arithmetic',
    ]);
  });

  it('looks games up by stable id', () => {
    registerGameDefinitions(SAMPLE_GAMES);
    expect(getGameDefinition('memory-match')?.name).toBe('Memory Match');
    expect(getGameDefinition('unknown')).toBeUndefined();
  });

  it('re-registration replaces the catalog', () => {
    registerGameDefinitions(SAMPLE_GAMES);
    registerGameDefinitions([
      {
        id: 'only',
        name: 'Only',
        primaryCategory: 'Speed',
        sdkVersion: '0.1.0',
        gameVersion: '1.0.0',
        generatorVersion: null,
        hasTutorial: false,
      },
    ]);
    expect(getAllGameDefinitions()).toHaveLength(1);
    expect(getGameDefinition('memory-match')).toBeUndefined();
  });

  it('covers the constitution primary categories', () => {
    expect(GAME_CATEGORIES).toContain('Memory');
    expect(GAME_CATEGORIES).toContain('Spatial');
    expect(GAME_CATEGORIES).toHaveLength(8);
  });
});
