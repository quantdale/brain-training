// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { SDK_VERSION } from '@/sdk';

import { gameDefinition } from '../game-definition';
import { GAME_ID } from '../types';
import gameJson from '../game.json';

describe('game.json', () => {
  it('satisfies the registry generator contract and the packet', () => {
    // The registry generator (scripts/generate-game-registry.mjs) requires the
    // id to equal the directory name and every field to pass defineGame.
    expect(gameJson.id).toBe(GAME_ID);
    expect(gameDefinition.id).toBe('math-missing-operator');
    expect(gameDefinition.name).toBe('Missing Operator');
    expect(gameDefinition.primaryCategory).toBe('Math');
    expect(gameDefinition.secondaryDomains).toEqual(['Logic & Problem Solving']);
    expect(gameDefinition.sdkVersion).toBe(SDK_VERSION);
    expect(gameDefinition.gameVersion).toBe('1.0.0');
    expect(gameDefinition.generatorVersion).toBe('1.0.0');
    expect(gameDefinition.hasTutorial).toBe(true);
    expect(gameDefinition.description).toBeTruthy();
  });
});