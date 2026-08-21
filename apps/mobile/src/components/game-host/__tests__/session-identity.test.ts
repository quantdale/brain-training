/**
 * Determinism/collision-safety tests for the shared session identity helpers
 * (campaign 010 D1 — new pure logic only; full suites stay out of scope).
 */
import { describe, expect, it } from '@jest/globals';

import { createSessionId, randomSeed, resolveSessionSeed } from '../session-identity';

describe('session-identity', () => {
  it('randomSeed produces 32-bit unsigned integer strings', () => {
    for (let i = 0; i < 100; i += 1) {
      const seed = randomSeed();
      expect(seed).toMatch(/^[0-9]+$/);
      expect(Number(seed)).toBeGreaterThanOrEqual(0);
      expect(Number(seed)).toBeLessThan(0xffffffff);
    }
  });

  it('resolveSessionSeed passes injected seeds through verbatim (seed is input)', () => {
    expect(resolveSessionSeed('fixed-seed')).toBe('fixed-seed');
    expect(resolveSessionSeed(12345)).toBe('12345');
    expect(resolveSessionSeed()).toMatch(/^[0-9]+$/);
  });

  it('createSessionId namespaces by game and never collides, even in the same ms', () => {
    const a = createSessionId('math-fast-math');
    const b = createSessionId('math-fast-math');
    expect(a).not.toBe(b);
    expect(a.startsWith('math-fast-math-')).toBe(true);
    // Distinct games sharing one millisecond must not collide either.
    expect(createSessionId('speed-reaction-time')).not.toContain('math-fast-math');
  });
});
