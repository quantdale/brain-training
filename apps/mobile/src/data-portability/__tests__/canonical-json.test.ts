/**
 * Canonical JSON hardening tests: prototype-safe deep copy and bounded emit
 * coalescing. Both are behavior-preserving guards — the canonical text and its
 * checksum must remain byte-for-byte identical.
 */
import { describe, expect, it } from '@jest/globals';

import {
  canonicalChunks,
  canonicalString,
  canonicalize,
  writeCanonicalJson,
} from '../canonical-json';
import { computeChecksum } from '../checksum';

describe('canonicalize is prototype-safe', () => {
  it('keeps a __proto__ own key as data and never touches Object.prototype', () => {
    // JSON.parse creates `__proto__` as an OWN data property.
    const parsed = JSON.parse(
      '{"__proto__":{"polluted":true},"safe":1}',
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);

    const out = canonicalize(parsed) as Record<string, unknown>;

    // The copy must still be an ordinary object whose prototype is untouched...
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect('polluted' in {}).toBe(false);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    // ...and the hostile key must survive as an own data property.
    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(true);
    expect(out.safe).toBe(1);

    // Canonical output is unchanged and round-trips through JSON.parse.
    const legacyText = JSON.stringify(parsed);
    const text = canonicalString(out);
    expect(text).toBe(canonicalString(parsed));
    expect(JSON.parse(text)).toEqual(JSON.parse(legacyText));
    expect(Object.getPrototypeOf(JSON.parse(text))).toBe(Object.prototype);
  });
});

describe('writeCanonicalJson output coalescing', () => {
  it('coalesces tokens into bounded chunks with byte-identical output', () => {
    const value = {
      items: Array.from({ length: 20_000 }, (_, i) => ({ id: i, label: `item-${i}` })),
    };
    const legacy = JSON.stringify(canonicalize(value));

    const chunks: string[] = [];
    writeCanonicalJson(value, (chunk) => chunks.push(chunk));
    const text = chunks.join('');

    // Byte parity with the legacy canonicalize+stringify pipeline.
    expect(text).toBe(legacy);
    expect(canonicalChunks(value).join('')).toBe(canonicalString(value));
    expect(computeChecksum(text)).toBe(computeChecksum(legacy));

    // Coalescing contract: every emitted chunk except the final remainder is
    // at least the flush threshold, so the ~40k-token payload produces a
    // handful of chunks instead of one string per token.
    expect(text.length).toBeGreaterThan(500_000);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.length).toBeGreaterThanOrEqual(16 * 1024);
    }
    expect(chunks.length).toBeLessThanOrEqual(
      Math.ceil(text.length / (16 * 1024)) + 1,
    );
  });
});
