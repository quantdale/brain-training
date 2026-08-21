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
    expect(pack.packVersion).toBe("1.0.0");
    expect(pack.chainCount).toBe(pack.chains.length);
    expect(loadContentPack()).toBe(pack); // memoized
  });

  it("every chain satisfies the lexical adjacency rule", () => {
    const pack = loadContentPack();
    expect(pack.chains.length).toBeGreaterThanOrEqual(12);
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
    expect(pack.decoyPool.length).toBeGreaterThanOrEqual(12);
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
    const twelve = [
      "apple", "brick", "cloud", "dream", "flame", "ghost",
      "honey", "ivory", "jungle", "koala", "light", "mango",
    ];
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        // "sun" is a chain word; swap it in for the last decoy.
        decoyPool: [...twelve.slice(0, 11), "sun"],
      }),
    ).toThrow(/decoyPool/);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        decoyPool: ["apple", "apple", ...twelve.slice(2)],
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      validateWordChainPack({
        ...basePack(),
        decoyPool: ["ab", ...twelve.slice(1)],
      }),
    ).toThrow(/single-token/);
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
