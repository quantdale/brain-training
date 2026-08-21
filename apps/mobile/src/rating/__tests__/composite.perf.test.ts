/**
 * Performance regression guard for the overall composite (task 08 / D).
 *
 * `computeComposite` is on the hot path for every Progress surface. The common
 * case is O(n) over `knownDomains`; the fallback branch that folds in ratings
 * absent from `knownDomains` uses a prebuilt Set membership check (O(1) per
 * entry, campaign 009 W07) so the whole computation stays linear. This test
 * pins the cost at scale and fails loudly if a change reintroduces quadratic
 * behavior.
 */
import { describe, expect, it } from "@jest/globals";

import {
  computeComposite,
  type DomainRatingWithStaleness,
} from "@/rating/composite";

function makeDataset(n: number): {
  ratings: DomainRatingWithStaleness[];
  known: string[];
} {
  const known = Array.from({ length: n }, (_, i) => `domain-${i}`);
  // Ratings are a strict subset of knownDomains → exercises the O(n) common path.
  const ratings = known.map((domain, i) => ({
    domain,
    rating: 1000 + (i % 400),
    sessions: 1 + (i % 20),
    updatedAt: 1_700_000_000_000 - i * 86_400_000,
  }));
  return { ratings, known };
}

function timeMs(fn: () => void): number {
  const start =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  fn();
  const end =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  return end - start;
}

describe("computeComposite performance", () => {
  // Best-of-N sampling: scheduler/GC noise on shared runners otherwise makes
  // single-shot micro-timings flaky (a real quadratic regression is orders of
  // magnitude above these bounds, so best-of-N preserves the guard's teeth).
  function bestOfMs(fn: () => void, runs = 3): number {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < runs; i += 1) {
      best = Math.min(best, timeMs(fn));
    }
    return best;
  }

  it("stays linear at scale (no accidental quadratic regression)", () => {
    const small = makeDataset(200);
    const large = makeDataset(4000);

    const smallMs = bestOfMs(() =>
      computeComposite(small.ratings, small.known, 1_700_000_000_000),
    );
    const largeMs = bestOfMs(() =>
      computeComposite(large.ratings, large.known, 1_700_000_000_000),
    );

    // 20x the inputs must cost far less than 20x the time (linear, not
    // quadratic — quadratic would be ~400x). Generous ceiling so it is stable
    // across CI runners; it only fails on a real complexity regression.
    expect(largeMs).toBeLessThan(smallMs * 20 + 50);
  });

  it("handles a large dataset within a bounded budget", () => {
    const { ratings, known } = makeDataset(4000);
    const ms = bestOfMs(() =>
      computeComposite(ratings, known, 1_700_000_000_000),
    );
    // A 4k-domain composite should be effectively free; 250ms leaves huge slack.
    expect(ms).toBeLessThan(250);
  });
});
