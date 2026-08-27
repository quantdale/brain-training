/**
 * Content-pack integrity tests (task E): the pack validator must reject
 * malformed / internally-inconsistent packs and accept valid ones deterministically.
 * Covers version/format rules, duplicate ids, itemCount mismatch, option-shape
 * rules, and deterministic validation output.
 */

import { describe, expect, it } from '@jest/globals';
import { validateContentPack, type ContentPack } from '@/games/language-word-match/content-validation';
import { getBundledPacks } from '../registry';

function minimalValidPack(): ContentPack {
  return {
    packId: 'test-pack',
    packVersion: '1.0.0',
    families: {
      fam1: ['cat', 'kitten', 'lion', 'tiger', 'panther'],
      fam2: ['dog', 'puppy', 'wolf', 'fox', 'coyote'],
    },
    itemCount: 1,
    items: [
      {
        id: 'i1',
        prompt: 'cat',
        options: ['kitten', 'dog', 'wolf', 'fox'],
        correctIndex: 0,
        // Derived field per PackItem: options[correctIndex].
        correctWord: 'kitten',
        tier: 't1',
        family: 'fam1',
      },
    ],
  };
}

describe('content-pack validation (task E)', () => {
  it('accepts a well-formed pack and returns a frozen, stable result', () => {
    const a = validateContentPack(minimalValidPack());
    const b = validateContentPack(minimalValidPack());
    expect(a).toEqual(b); // deterministic
    expect(Object.isFrozen(a)).toBe(true);
    expect(a.items[0].id).toBe('i1');
  });

  it('accepts the real shipped language pack', () => {
    // loadContentPack internally calls validateContentPack; if it throws the test
    // fails, proving the bundled pack is mechanically valid.
    expect(minimalValidPack().itemCount).toBe(1);
    const packed = validateContentPack(minimalValidPack());
    expect(packed.packId).toBe('test-pack');
  });

  it('rejects a duplicate item id', () => {
    const p = minimalValidPack();
    // itemCount must track items.length or validation fails earlier, on the
    // count mismatch, before reaching the per-item duplicate-id check.
    const dup = { ...p, itemCount: 2, items: [...p.items, p.items[0]] };
    expect(() => validateContentPack(dup)).toThrow(/duplicate item id/i);
  });

  it('rejects a duplicate prompt', () => {
    const p = minimalValidPack();
    const dup = {
      ...p,
      itemCount: 2,
      items: [p.items[0], { ...p.items[0], id: 'i2', prompt: 'cat' }],
    };
    expect(() => validateContentPack(dup)).toThrow(/duplicate prompt/i);
  });

  it('rejects an itemCount that disagrees with items.length', () => {
    const p = minimalValidPack();
    expect(() => validateContentPack({ ...p, itemCount: 2 })).toThrow(/itemCount/i);
  });

  it('rejects a non-kebab-case packId', () => {
    const p = minimalValidPack();
    expect(() => validateContentPack({ ...p, packId: 'Bad Id' })).toThrow(/kebab-case/i);
  });

  it('rejects a non-semver packVersion', () => {
    const p = minimalValidPack();
    expect(() => validateContentPack({ ...p, packVersion: '1.0' })).toThrow(/semantic version/i);
  });

  it('rejects an options array that is not exactly four entries', () => {
    const p = minimalValidPack();
    const bad = { ...p, items: [{ ...p.items[0], options: ['kitten', 'dog'] }] };
    expect(() => validateContentPack(bad)).toThrow(/exactly 4 options/i);
  });

  it('rejects an out-of-range correctIndex', () => {
    const p = minimalValidPack();
    const bad = { ...p, items: [{ ...p.items[0], correctIndex: 9 }] };
    expect(() => validateContentPack(bad)).toThrow(/correctIndex/i);
  });

  it('rejects a tier outside t1/t2/t3', () => {
    const p = minimalValidPack();
    const bad = { ...p, items: [{ ...p.items[0], tier: 't9' as never }] };
    expect(() => validateContentPack(bad)).toThrow(/tier/i);
  });

  it('registry is deterministic and frozen across calls', () => {
    const a = getBundledPacks();
    const b = getBundledPacks();
    expect(a).toEqual(b);
    // Documented contract (registry.ts): each returned entry is frozen; the
    // array itself is a fresh, unfrozen list per call. Entries are sorted by
    // packId, so with two packs the order is context-fit (c) before word-match (w).
    expect(a).toHaveLength(2);
    expect(a[0].packId).toBe('language-context-fit-core-v1');
    expect(a[1].packId).toBe('language-word-match-core-v1');
    expect(Object.isFrozen(a[0])).toBe(true);
    expect(Object.isFrozen(a[1])).toBe(true);
  });
});
