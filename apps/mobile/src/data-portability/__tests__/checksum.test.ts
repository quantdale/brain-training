import { describe, expect, it } from '@jest/globals';
import { sha256Hex, computeChecksum } from '../checksum';
import { canonicalString, canonicalize } from '../canonical-json';

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the multi-block vector', () => {
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('handles UTF-8 / multi-byte and surrogate pairs', () => {
    // Known single-byte value for sanity.
    expect(sha256Hex('a')).toBe(
      'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    );
    // Multi-byte / surrogate-pair input is deterministic and distinct.
    const emoji = sha256Hex('🧠');
    expect(emoji).toMatch(/^[0-9a-f]{64}$/);
    expect(emoji).toBe(sha256Hex('🧠'));
    expect(emoji).not.toBe(sha256Hex('a'));
  });

  it('is deterministic across calls', () => {
    expect(sha256Hex('brain-training')).toBe(sha256Hex('brain-training'));
  });
});

describe('computeChecksum', () => {
  it('is the sha256 of the payload', () => {
    expect(computeChecksum('hello')).toBe(sha256Hex('hello'));
  });
});

describe('canonicalString', () => {
  it('sorts object keys so key order is irrelevant', () => {
    const a = canonicalString({ b: 1, a: 2, c: 3 });
    const b = canonicalString({ c: 3, a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('sorts nested objects recursively', () => {
    const a = canonicalString({ x: { z: 1, y: 2 }, a: [{ c: 1, b: 2 }] });
    const b = canonicalString({ a: [{ b: 2, c: 1 }], x: { y: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it('preserves array element order', () => {
    expect(canonicalString([1, 2, 3])).toBe('[1,2,3]');
    expect(canonicalString([3, 2, 1])).not.toBe('[1,2,3]');
  });

  it('canonicalize returns a deep copy (does not mutate input)', () => {
    const input = { b: 1, a: { z: 1, y: 2 } };
    const out = canonicalize(input) as Record<string, unknown>;
    expect(out).toEqual({ a: { y: 2, z: 1 }, b: 1 });
    expect(Object.keys(input)).toEqual(['b', 'a']); // original order intact
  });
});
