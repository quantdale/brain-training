/**
 * Composite rating tests (006R task 9.5).
 *
 * Tests the overall cognitive/performance composite calculation.
 */
import { describe, expect, it } from '@jest/globals';

import { computeComposite } from '@/rating/composite';
import { INITIAL_RATING } from '@/db/rating';

const KNOWN_DOMAINS = ['Memory', 'Attention', 'Speed', 'Math', 'Language', 'Logic & Problem Solving', 'Flexibility', 'Spatial'];

describe('computeComposite', () => {
  it('returns INITIAL_RATING when no ratings exist', () => {
    const result = computeComposite([], KNOWN_DOMAINS, Date.now());
    expect(result.composite).toBe(INITIAL_RATING);
    expect(result.domainCount).toBe(KNOWN_DOMAINS.length);
  });

  it('computes average of domain ratings', () => {
    const now = Date.now();
    const ratings = [
      { domain: 'Memory', rating: 1100, sessions: 5, updatedAt: now },
      { domain: 'Attention', rating: 900, sessions: 3, updatedAt: now },
    ];
    
    const result = computeComposite(ratings, KNOWN_DOMAINS, now);
    // Expected: (1100 + 900 + 6 * INITIAL_RATING) / 8
    const expected = Math.round((1100 + 900 + 6 * INITIAL_RATING) / 8);
    expect(result.composite).toBe(expected);
    expect(result.domainCount).toBe(KNOWN_DOMAINS.length);
  });

  it('reports stale domains without discounting them (§15)', () => {
    const now = Date.now();
    const staleTime = now - 60 * 24 * 60 * 60 * 1000; // 60 days ago

    const ratings = [
      { domain: 'Memory', rating: 1100, sessions: 5, updatedAt: now }, // fresh
      { domain: 'Attention', rating: 900, sessions: 3, updatedAt: staleTime }, // stale
    ];

    const result = computeComposite(ratings, KNOWN_DOMAINS, now);
    expect(result.staleDomainCount).toBe(1);
    expect(result.domainCount).toBe(KNOWN_DOMAINS.length);
    expect(result.composite).toBe(Math.round((1100 + 900 + 6 * INITIAL_RATING) / 8));
  });

  it('includes domains not in knownDomains', () => {
    const now = Date.now();
    const ratings = [
      { domain: 'Memory', rating: 1100, sessions: 5, updatedAt: now },
      { domain: 'Custom', rating: 1200, sessions: 2, updatedAt: now },
    ];
    
    const result = computeComposite(ratings, KNOWN_DOMAINS, now);
    expect(result.domains).toContain('Custom');
    expect(result.domainCount).toBe(KNOWN_DOMAINS.length + 1);
  });

  it('handles empty knownDomains', () => {
    const now = Date.now();
    const ratings = [
      { domain: 'Memory', rating: 1100, sessions: 5, updatedAt: now },
    ];
    
    const result = computeComposite(ratings, [], now);
    expect(result.composite).toBe(1100);
    expect(result.domainCount).toBe(1);
  });
});
