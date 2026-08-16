// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';
import { testId } from '../testid';

describe('testId', () => {
  it('joins gameId and element with dots', () => {
    expect(testId('memory-sequence', 'tile')).toBe('memory-sequence.tile');
  });

  it('supports nested elements for deep automation targets', () => {
    expect(testId('memory-sequence', 'tile', '3')).toBe('memory-sequence.tile.3');
  });

  it('drops empty parts instead of producing stray dots', () => {
    expect(testId('game', '')).toBe('game');
    expect(testId('game', 'a', '', 'b')).toBe('game.a.b');
    expect(testId('')).toBe('');
  });

  it('is deterministic and pure', () => {
    expect(testId('speed-simon', 'button', 'go')).toBe(testId('speed-simon', 'button', 'go'));
  });

  it('composes with pause overlay spec (cross-module usage)', () => {
    // Matches the convention used by createPauseOverlaySpec.
    expect(testId('math-facts', 'pause-overlay')).toBe('math-facts.pause-overlay');
  });
});
