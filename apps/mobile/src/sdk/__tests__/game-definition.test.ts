// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';
import { defineGame, parseGameDefinitionJson, GAME_CATEGORIES, isGameCategory } from '../types/game-definition';
import type { GameDefinition } from '../types/game-definition';

const VALID: GameDefinition = {
  id: 'memory-sequence',
  name: 'Memory Sequence',
  primaryCategory: 'Memory',
  sdkVersion: '0.1.0',
  gameVersion: '1.0.0',
  generatorVersion: '1.0.0',
  contentVersion: null,
  hasTutorial: true,
};

describe('defineGame', () => {
  it('accepts a valid definition and freezes it', () => {
    const def = defineGame(VALID);
    expect(def.id).toBe('memory-sequence');
    expect(Object.isFrozen(def)).toBe(true);
  });

  it('accepts generatorVersion null and optional secondaryDomains', () => {
    const def = defineGame({
      ...VALID,
      id: 'word-match',
      generatorVersion: null,
      secondaryDomains: ['Language', 'Attention'],
    });
    expect(def.generatorVersion).toBeNull();
    expect(def.secondaryDomains).toEqual(['Language', 'Attention']);
  });

  it('normalizes an empty secondaryDomains away', () => {
    const def = defineGame({ ...VALID, secondaryDomains: [] });
    expect(def.secondaryDomains).toBeUndefined();
  });

  it('rejects invalid ids, categories, and types', () => {
    expect(() => defineGame({ ...VALID, id: 'Memory-Sequence' })).toThrow('kebab-case');
    expect(() => defineGame({ ...VALID, id: 'bad id' })).toThrow('kebab-case');
    expect(() => defineGame({ ...VALID, id: '' })).toThrow('kebab-case');
    expect(() => defineGame({ ...VALID, primaryCategory: 'Superpower' as never })).toThrow(
      'primaryCategory',
    );
    expect(() => defineGame({ ...VALID, hasTutorial: 'yes' as never })).toThrow('hasTutorial');
    expect(() => defineGame({ ...VALID, generatorVersion: '' })).toThrow('generatorVersion');
    expect(() => defineGame({ ...VALID, secondaryDomains: ['Nope'] as never })).toThrow(
      'secondaryDomains',
    );
  });

  it('exposes the eight constitution categories', () => {
    expect(GAME_CATEGORIES).toEqual([
      'Memory',
      'Attention',
      'Speed',
      'Math',
      'Language',
      'Logic & Problem Solving',
      'Flexibility',
      'Spatial',
    ]);
    for (const category of GAME_CATEGORIES) expect(isGameCategory(category)).toBe(true);
    expect(isGameCategory('Memory Game')).toBe(false);
  });
});

describe('parseGameDefinitionJson (registry generator input)', () => {
  it('round-trips a game.json object', () => {
    const json: GameDefinition = {
      id: 'memory-sequence',
      name: 'Memory Sequence',
      primaryCategory: 'Memory',
      sdkVersion: '0.1.0',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      contentVersion: null,
      hasTutorial: true,
      secondaryDomains: ['Attention'],
    };
    const def = parseGameDefinitionJson(json);
    expect(def).toEqual(defineGame(json));
    expect(Object.isFrozen(def)).toBe(true);
  });

  it('accepts generatorVersion null and missing secondaryDomains', () => {
    const def = parseGameDefinitionJson({ ...VALID, generatorVersion: null });
    expect(def.generatorVersion).toBeNull();
    expect(def.secondaryDomains).toBeUndefined();
  });

  it('rejects malformed game.json payloads', () => {
    expect(() => parseGameDefinitionJson(null)).toThrow('JSON object');
    expect(() => parseGameDefinitionJson([VALID])).toThrow('JSON object');
    expect(() => parseGameDefinitionJson({ ...VALID, name: 42 })).toThrow('name');
    expect(() => parseGameDefinitionJson({ ...VALID, primaryCategory: 'Chess' })).toThrow();
    expect(() => parseGameDefinitionJson({ ...VALID, secondaryDomains: 'Memory' })).toThrow(
      'secondaryDomains',
    );
    expect(() => parseGameDefinitionJson({ ...VALID, generatorVersion: 3 })).toThrow(
      'generatorVersion',
    );
  });
});
