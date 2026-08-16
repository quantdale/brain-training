// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  TIERS,
  validateContentPack,
} from '../content-validation';
import { loadContentPack } from '../content-validation';
import packJson from '../content/pack.json';

/** Deep-clone the real pack for mutation tests (no shared references). */
function clonePack(): any {
  return JSON.parse(JSON.stringify(packJson));
}

describe('bundled content pack', () => {
  it('validates and is the expected curated pack', () => {
    const pack = loadContentPack();
    expect(pack.packId).toBe('language-word-match-core-v1');
    expect(pack.packVersion).toBe('1.0.0');
    expect(pack.itemCount).toBe(pack.items.length);
  });

  it('is frozen (no accidental mutation at runtime)', () => {
    const pack = loadContentPack();
    expect(Object.isFrozen(pack)).toBe(true);
    expect(Object.isFrozen(pack.items)).toBe(true);
    expect(Object.isFrozen(pack.items[0])).toBe(true);
    expect(Object.isFrozen(pack.items[0].options)).toBe(true);
  });

  it('meets the packet floor: ≥ 60 original items spanning all tiers', () => {
    const pack = loadContentPack();
    expect(pack.items.length).toBeGreaterThanOrEqual(60);
    for (const tier of TIERS) {
      expect(pack.items.filter((item) => item.tier === tier).length).toBeGreaterThanOrEqual(20);
    }
    expect(Object.keys(pack.families).length).toBeGreaterThanOrEqual(10);
  });

  it('has no duplicate prompts or item ids anywhere in the pack', () => {
    const pack = loadContentPack();
    const prompts = new Set(pack.items.map((item) => item.prompt));
    const ids = new Set(pack.items.map((item) => item.id));
    expect(prompts.size).toBe(pack.items.length);
    expect(ids.size).toBe(pack.items.length);
  });

  it('has every word in exactly one semantic family (disjoint neighbor sets)', () => {
    const pack = loadContentPack();
    const owner = new Map<string, string>();
    for (const [familyId, words] of Object.entries(pack.families)) {
      for (const word of words) {
        expect(owner.has(word)).toBe(false);
        owner.set(word, familyId);
      }
    }
    expect(owner.size).toBe(Object.values(pack.families).flat().length);
  });

  it('every item: 4 distinct options, valid correctIndex, words from its family', () => {
    const pack = loadContentPack();
    for (const item of pack.items) {
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options).size).toBe(4);
      expect(item.correctIndex).toBeGreaterThanOrEqual(0);
      expect(item.correctIndex).toBeLessThan(4);
      expect(item.correctWord).toBe(item.options[item.correctIndex]);
      expect(item.correctWord).not.toBe(item.prompt);
      expect(item.options).not.toContain(item.prompt);
      const familyWords = new Set(pack.families[item.family]);
      for (const word of [item.prompt, ...item.options]) {
        expect(familyWords.has(word)).toBe(true);
      }
      expect(TIERS).toContain(item.tier);
    }
  });

  it('distractors are genuine semantic neighbors, never the correct word', () => {
    const pack = loadContentPack();
    for (const item of pack.items) {
      const distractors = item.options.filter((_, index) => index !== item.correctIndex);
      expect(distractors).toHaveLength(3);
      // Same family guarantees same part of speech / semantic neighborhood.
      for (const distractor of distractors) {
        expect(pack.families[item.family]).toContain(distractor);
        expect(distractor).not.toBe(item.correctWord);
      }
    }
  });
});

describe('validateContentPack rejection cases', () => {
  it('rejects non-object input and missing/empty packId or packVersion', () => {
    expect(() => validateContentPack(null)).toThrow(/must be a JSON object/);
    expect(() => validateContentPack([])).toThrow(/must be a JSON object/);
    const noId = clonePack();
    delete noId.packId;
    expect(() => validateContentPack(noId)).toThrow(/packId/);
    const badVersion = clonePack();
    badVersion.packVersion = '1.0';
    expect(() => validateContentPack(badVersion)).toThrow(/packVersion/);
  });

  it('rejects an itemCount that does not match the items array', () => {
    const pack = clonePack();
    pack.itemCount = pack.items.length + 1;
    expect(() => validateContentPack(pack)).toThrow(/itemCount/);
  });

  it('rejects duplicate item ids and duplicate prompts', () => {
    const dupId = clonePack();
    dupId.items[1].id = dupId.items[0].id;
    expect(() => validateContentPack(dupId)).toThrow(/duplicate item id/);
    const dupPrompt = clonePack();
    dupPrompt.items[1].prompt = dupPrompt.items[0].prompt;
    expect(() => validateContentPack(dupPrompt)).toThrow(/duplicate prompt/);
  });

  it('rejects wrong option counts and out-of-range correctIndex', () => {
    const threeOptions = clonePack();
    threeOptions.items[0].options = threeOptions.items[0].options.slice(0, 3);
    expect(() => validateContentPack(threeOptions)).toThrow(/exactly 4 options/);
    const highIndex = clonePack();
    highIndex.items[0].correctIndex = 4;
    expect(() => validateContentPack(highIndex)).toThrow(/correctIndex/);
    const negativeIndex = clonePack();
    negativeIndex.items[0].correctIndex = -1;
    expect(() => validateContentPack(negativeIndex)).toThrow(/correctIndex/);
  });

  it('rejects duplicated options within an item', () => {
    const pack = clonePack();
    pack.items[0].options[1] = pack.items[0].options[0];
    expect(() => validateContentPack(pack)).toThrow(/duplicate word/);
  });

  it('rejects an option that duplicates the correct word', () => {
    const pack = clonePack();
    const item = pack.items[0];
    // Put the correct word at a second position as well.
    item.options[3] = item.options[item.correctIndex];
    expect(() => validateContentPack(pack)).toThrow(/duplicate word/);
  });

  it('rejects the prompt appearing among the options', () => {
    const pack = clonePack();
    pack.items[0].options[2] = pack.items[0].prompt;
    expect(() => validateContentPack(pack)).toThrow(/must not appear among the options/);
  });

  it('rejects a correct answer identical to the prompt', () => {
    const pack = clonePack();
    const item = pack.items[0];
    item.options[item.correctIndex] = item.prompt;
    // Replace the old prompt-as-option collision with a distinct word.
    item.options[3] = 'zz-not-a-family-word';
    expect(() => validateContentPack(pack)).toThrow(/must differ from the prompt/);
  });

  it('rejects unknown tiers, unknown families, and words outside the family', () => {
    const badTier = clonePack();
    badTier.items[0].tier = 't4';
    expect(() => validateContentPack(badTier)).toThrow(/tier/);
    const unknownFamily = clonePack();
    unknownFamily.items[0].family = 'nope';
    expect(() => validateContentPack(unknownFamily)).toThrow(/family/);
    const foreignWord = clonePack();
    foreignWord.items[0].options[3] = 'unrelated';
    expect(() => validateContentPack(foreignWord)).toThrow(/not a member of family/);
  });

  it('rejects families with fewer than 5 words and words shared across families', () => {
    const tinyFamily = clonePack();
    tinyFamily.families = { tiny: ['a', 'b', 'c', 'd'] };
    tinyFamily.items = [];
    tinyFamily.itemCount = 0;
    expect(() => validateContentPack(tinyFamily)).toThrow(/at least 5 words/);
    const shared = clonePack();
    shared.families.happiness.push('sad');
    expect(() => validateContentPack(shared)).toThrow(/both family/);
  });
});
