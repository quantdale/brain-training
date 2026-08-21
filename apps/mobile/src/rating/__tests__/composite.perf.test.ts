/**
 * Performance regression guard for the overall composite (task 08 / D).
 *
 * `computeComposite` is on the hot path for every Progress surface. The common
 * case is O(n) over `knownDomains`, but the fallback branch that folds in
 * ratings absent from `knownDomains` uses `knownDomains.includes(...)`
 * (O(n) per entry → O(n^2) worst case). This test pins the common-case cost
 * at scale and fails loudly if a change reintroduces quadratic behavior.
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
  it("stays linear at scale (no accidental quadratic regression)", () => {
    const small = makeDataset(200);
    const large = makeDataset(4000);

    const smallMs = timeMs(() =>
      computeComposite(small.ratings, small.known, 1_700_000_000_000),
    );
    const largeMs = timeMs(() =>
      computeComposite(large.ratings, large.known, 1_700_000_000_000),
    );

    // 20x the inputs must cost far less than 20x the time (linear, not quadratic).
    // Generous ceiling so it is stable across CI runners; it only fails on a
    // real complexity regression.
    expect(largeMs).toBeLessThan(smallMs * 20 + 25);
  });

  it("handles a large dataset within a bounded budget", () => {
    const { ratings, known } = makeDataset(4000);
    const ms = timeMs(() =>
      computeComposite(ratings, known, 1_700_000_000_000),
    );
    // A 4k-domain composite should be effectively free; 250ms leaves huge slack.
    expect(ms).toBeLessThan(250);
  });
});
