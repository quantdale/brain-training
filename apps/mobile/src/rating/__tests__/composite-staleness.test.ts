/**
 * Constitution §15: "Inactivity should not directly decay ratings; instead
 * reduce confidence/mark stale." Staleness is therefore reporting only: the
 * composite must be identical however long ago a domain was last played.
 */
import { describe, expect, it } from '@jest/globals';

import { computeComposite, type DomainRatingWithStaleness } from '@/rating/composite';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const SIX_DOMAINS = ['Memory', 'Attention', 'Speed', 'Math', 'Language', 'Spatial'];

function rating(domain: string, value: number, ageDays = 0): DomainRatingWithStaleness {
  return { domain, rating: value, sessions: 5, updatedAt: NOW - ageDays * DAY };
}

describe('computeComposite staleness (§15)', () => {
  it('does not lower the composite when a played domain goes stale', () => {
    const fresh = computeComposite([rating('Memory', 1500)], SIX_DOMAINS, NOW);
    const stale = computeComposite([rating('Memory', 1500, 60)], SIX_DOMAINS, NOW);

    expect(fresh.composite).toBe(1083);
    expect(stale.composite).toBe(fresh.composite);
    expect(stale.staleDomainCount).toBe(1);
    expect(fresh.staleDomainCount).toBe(0);
  });

  it('does not raise the composite when a below-baseline domain goes stale', () => {
    const fresh = computeComposite([rating('Memory', 700)], SIX_DOMAINS, NOW);
    const stale = computeComposite([rating('Memory', 700, 60)], SIX_DOMAINS, NOW);

    expect(stale.composite).toBe(fresh.composite);
  });

  it('keeps ratings outside the known-domain list time-invariant too', () => {
    const fresh = computeComposite([rating('Custom', 1500)], SIX_DOMAINS, NOW);
    const stale = computeComposite([rating('Custom', 1500, 60)], SIX_DOMAINS, NOW);

    expect(stale.composite).toBe(fresh.composite);
    expect(stale.staleDomainCount).toBe(1);
    expect(stale.domainCount).toBe(fresh.domainCount);
  });

  it('still reports a corrupt timestamp as stale without discounting the rating', () => {
    const corrupt = { ...rating('Memory', 1500), updatedAt: Number.NaN };
    const result = computeComposite([corrupt], SIX_DOMAINS, NOW);

    expect(result.staleDomainCount).toBe(1);
    expect(result.composite).toBe(1083);
  });
});
