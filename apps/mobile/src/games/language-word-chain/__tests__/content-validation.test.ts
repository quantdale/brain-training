// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  TIERS,
  WordChainPackError,
  isTier,
  loadContentPack,
  validateWordChainPack,
} from "../content-validation";

describe("loadContentPack", () => {
  it("loads and validates the bundled pack (memoized)", () => {
    const pack = loadContentPack();
    expect(pack.packId).toBe("language-word-chain-core-v1");
    expect(pack.packVersion).toBe("1.3.0");
    expect(pack.chainCount).toBe(90);
    expect(pack.chains.length).toBe(90);
    expect(pack.chainCount).toBe(pack.chains.length);
    expect(loadContentPack()).toBe(pack); // memoized
  });

  it("every chain satisfies the lexical adjacency rule", () => {
    const pack = loadContentPack();
    expect(pack.chains.length).toBeGreaterThanOrEqual(90);
    for (const chain of pack.chains) {
      expect(TIERS).toContain(chain.tier);
      expect(chain.words.length).toBeGreaterThanOrEqual(4);
      expect(chain.words.length).toBeLessThanOrEqual(6);
      for (let i = 1; i < chain.words.length; i += 1) {
        expect(chain.words[i][0]).toBe(
          chain.words[i - 1][chain.words[i - 1].length - 1],
        );
      }
    }
  });

  it("chain words are globally disjoint and disjoint from the decoy pool", () => {
    const pack = loadContentPack();
    const seen = new Set<string>();
    for (const chain of pack.chains) {
      for (const word of chain.words) {
        expect(seen.has(word)).toBe(false);
        seen.add(word);
      }
    }
    for (const decoy of pack.decoyPool) {
      expect(seen.has(decoy)).toBe(false);
    }
    // Enough decoys to fill the largest option row with valid distractors.
    expect(pack.decoyPool.length).toBeGreaterThanOrEqual(30);
  });

  it("pack-count gate: declared==actual, >=90 total, >=30 per tier", () => {
    const pack = loadContentPack();
    expect(pack.chainCount).toBe(pack.chains.length);
    expect(pack.chains.length).toBeGreaterThanOrEqual(90);
    const counts = { t1: 0, t2: 0, t3: 0 } as Record<string, number>;
    for (const c of pack.chains) counts[c.tier] += 1;
    expect(counts.t1).toBeGreaterThanOrEqual(30);
    expect(counts.t2).toBeGreaterThanOrEqual(30);
    expect(counts.t3).toBeGreaterThanOrEqual(30);
  });

  it("decoy diversity: ≥30 decoys, ≥15 distinct initials, balanced", () => {
    const pack = loadContentPack();
    expect(pack.decoyPool.length).toBeGreaterThanOrEqual(30);
    const initials = new Set(pack.decoyPool.map((w) => w[0]));
    expect(initials.size).toBeGreaterThanOrEqual(15);
    const counts = new Map<string, number>();
    for (const w of pack.decoyPool) counts.set(w[0], (counts.get(w[0]) ?? 0) + 1);
    const max = Math.max(...counts.values());
    expect(max).toBeLessThanOrEqual(Math.ceil(pack.decoyPool.length * 0.25));
  });
});

function basePack(): Record<string, unknown> {
  return {
    packId: "test-pack",
    packVersion: "1.0.0",
    chainCount: 1,
    decoyPool: [
      "apple", "brick", "cloud", "dream", "flame", "ghost",
      "honey", "ivory", "jungle", "koala", "light", "mango",
      "night", "olive", "pearl", "quilt", "robin", "stone",
      "umbrella", "velvet", "whale", "yogurt", "pencil", "mirror",
      "basket", "garden", "window", "pillow", "silver", "autumn",
    ],
    chains: [{ id: "c1", tier: "t1", words: ["sun", "nest", "train", "north"] }],
  };
}

describe("validateWordChainPack rejections", () => {
  it("accepts a well-formed pack", () => {
    const pack = validateWordChainPack(basePack());
    expect(pack.chains).toHaveLength(1);
    expect(Object.isFrozen(pack)).toBe(true);
  });

  it("rejects non-objects and bad identity fields", () => {
    expect(() => validateWordChainPack(null)).toThrow(WordChainPackError);
    expect(() => validateWordChainPack("nope")).toThrow(WordChainPackError);
    expect(() =>
      validateWordChainPack({ ...basePack(), packId: "Bad Id" }),
    ).toThrow(/packId/);
    expect(() =>
      validateWordChainPack({ ...basePack(), packVersion: "1.0" }),
    ).toThrow(/packVersion/);
  });

  it("rejects broken adjacency and malformed chains", () => {
    const broken = basePack();
    (broken.chains as unknown[])[0] = {
      id: "c1",
      tier: "t1",
      words: ["sun", "nest", "dog", "north"],
    };
    expect(() => validateWordChainPack(broken)).toThrow(/adjacency/);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        chains: [{ id: "c1", tier: "t4", words: ["sun", "nest", "train", "north"] }],
      }),
    ).toThrow(/tier/);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        chains: [{ id: "c1", tier: "t1", words: ["sun", "nest", "go"] }],
      }),
    ).toThrow(/4\.\.6|words/);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        chains: [
          { id: "c1", tier: "t1", words: ["Sun", "nest", "train", "north"] },
        ],
      }),
    ).toThrow(/single-token/);
  });

  it("rejects duplicate ids, duplicate words across chains, and count mismatch", () => {
    const twoChains = {
      ...basePack(),
      chainCount: 2,
      chains: [
        { id: "c1", tier: "t1", words: ["sun", "nest", "train", "north"] },
        { id: "c1", tier: "t2", words: ["cat", "tree", "eagle", "earth"] },
      ],
    };
    expect(() => validateWordChainPack(twoChains)).toThrow(/duplicate chain id/);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        chainCount: 2,
        chains: [
          { id: "c1", tier: "t1", words: ["sun", "nest", "train", "north"] },
          { id: "c2", tier: "t2", words: ["nest", "train", "eagle", "earth"] },
        ],
      }),
    ).toThrow(/more than one chain/);
    expect(() =>
      validateWordChainPack({ ...basePack(), chainCount: 5 }),
    ).toThrow(/chainCount/);
  });

  it("rejects a decoy that collides with a chain word or duplicates itself", () => {
    const thirty = basePack().decoyPool as string[];
    expect(thirty.length).toBeGreaterThanOrEqual(30);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        // "sun" is a chain word; swap it in for the last decoy.
        decoyPool: [...thirty.slice(0, 29), "sun"],
      }),
    ).toThrow(/decoyPool/);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        decoyPool: ["apple", "apple", ...thirty.slice(2)],
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        decoyPool: ["ab", ...thirty.slice(1)],
      }),
    ).toThrow(/single-token/);
  });

  it("rejects reordered / near-duplicate chains", () => {
    // Two chains sharing ≥2 words must be rejected as near-duplicates.
    // Build a 90-chain core pack by cloning the real pack and replacing two t1 chains with near-duplicates using fresh words not in the pack.
    const base = [...loadContentPack().chains];
    base[0] = { id: "wc-near-01", tier: "t1", words: ["abed", "dawn", "nexus", "sycamore"] };
    base[1] = { id: "wc-near-02", tier: "t1", words: ["abed", "dawn", "nexus", "solace"] }; // shares abed,dawn,nexus → ≥2
    const coreNearDup = {
      packId: "language-word-chain-core-v1",
      packVersion: "1.0.0",
      chainCount: 90,
      decoyPool: [...loadContentPack().decoyPool] as unknown as string[],
      chains: base,
    };
    expect(() => validateWordChainPack(coreNearDup)).toThrow(/near-duplicate|more than one chain/);

    // Duplicate sequence is also rejected (exact same order) – already covered, but verify near-duplicate threshold.
    const dupSeq = {
      packId: "test-pack",
      packVersion: "1.0.0",
      chainCount: 2,
      decoyPool: basePack().decoyPool as string[],
      chains: [
        { id: "c1", tier: "t1", words: ["sun", "nest", "train", "north"] },
        { id: "c2", tier: "t1", words: ["sun", "nest", "train", "north"] },
      ],
    };
    expect(() => validateWordChainPack(dupSeq)).toThrow(/more than one chain|duplicate/);
  });

  it("rejects tier-constraint violations for the core pack", () => {
    // Core pack with only 30 total should fail ≥90 gate.
    const smallCore = {
      packId: "language-word-chain-core-v1",
      packVersion: "1.0.0",
      chainCount: 30,
      decoyPool: [...loadContentPack().decoyPool] as unknown as string[],
      chains: loadContentPack().chains.slice(0, 30),
    };
    expect(() => validateWordChainPack(smallCore)).toThrow(/at least 90/);

    // Core pack with 90 but uneven tiers (t1 only 10) should fail per-tier gate.
    // Take real 90 and re-label 20 t1 chains to t2 so t1 drops to 10.
    const unevenChains = loadContentPack().chains.map((c, idx) => {
      if (c.tier === "t1" && idx < 20) {
        return { ...c, tier: "t2" as const };
      }
      return { ...c };
    });
    const uneven = {
      packId: "language-word-chain-core-v1",
      packVersion: "1.0.0",
      chainCount: 90,
      decoyPool: [...loadContentPack().decoyPool] as unknown as string[],
      chains: unevenChains,
    };
    expect(() => validateWordChainPack(uneven)).toThrow(/tier t1 must have at least 30/);
  });
  it("rejects inadequate decoy diversity", () => {
    // Too few decoys
    expect(() =>
      validateWordChainPack({
        packId: "test-pack",
        packVersion: "1.0.0",
        chainCount: 1,
        decoyPool: ["apple", "brick", "cloud", "dream", "flame", "ghost", "honey", "ivory", "jungle", "koala", "light", "mango"],
        chains: [{ id: "c1", tier: "t1", words: ["sun", "nest", "train", "north"] }],
      }),
    ).toThrow(/at least 30/);

    // Not enough distinct initials (30 words all starting with 'a' – distinct initials =1)
    const monoInitialPool = Array.from({ length: 30 }, (_, i) => {
      const a = String.fromCharCode(98 + (i % 24)); // b..y
      const b = String.fromCharCode(97 + (i % 26));
      return `a${a}${b}x`; // all start with 'a', distinct e.g., abax, acbx...
    });
    expect(() =>
      validateWordChainPack({
        packId: "test-pack",
        packVersion: "1.0.0",
        chainCount: 1,
        decoyPool: monoInitialPool,
        chains: [{ id: "c1", tier: "t1", words: ["sun", "nest", "train", "north"] }],
      }),
    ).toThrow(/distinct initials/);
  });
});

describe("isTier", () => {
  it("guards the tier union", () => {
    for (const tier of TIERS) {
      expect(isTier(tier)).toBe(true);
    }
    expect(isTier("t4")).toBe(false);
    expect(isTier(1)).toBe(false);
  });
});
