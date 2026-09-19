/**
 * Campaign 053 (tasks 2.4/2.5) — app-owned route input envelope contract.
 *
 * Pins the canonical forms and bounds for every app-owned route parameter and
 * the defense-in-depth attribution: app-local validation protects app-owned
 * selection/persistence and is explicitly NOT remediation for upstream URL
 * decoding (the accepted `decode-uri-component` advisory remains subject to
 * the dependency disposition in
 * `scripts/certification/dependency-audit-allowlist.json`).
 */
import { describe, expect, it } from '@jest/globals';

import {
  MAX_ROUTE_LEG_INDEX,
  MAX_ROUTE_PARAM_LENGTH,
  parseBoundedLegIndex,
  parseCanonicalDomain,
  parseCanonicalGameId,
  parseCanonicalInstanceKey,
  parseCanonicalSessionId,
  parseRegisteredGameId,
} from '@/routing/route-params';
import { registerGameDefinitions } from '@/registry/registry';

const OVERSIZED = 'a'.repeat(MAX_ROUTE_PARAM_LENGTH + 1);

describe('route input envelope: game ids', () => {
  it('accepts canonical registry ids', () => {
    expect(parseCanonicalGameId('memory')).toBe('memory');
    expect(parseCanonicalGameId('attention-odd-one-out')).toBe(
      'attention-odd-one-out',
    );
    expect(parseCanonicalGameId(['logic-rule-grid'])).toBe('logic-rule-grid');
  });

  it('rejects malformed and oversized ids', () => {
    expect(parseCanonicalGameId('')).toBeNull();
    expect(parseCanonicalGameId(undefined)).toBeNull();
    expect(parseCanonicalGameId(null)).toBeNull();
    expect(parseCanonicalGameId(42)).toBeNull();
    expect(parseCanonicalGameId(OVERSIZED)).toBeNull();
    // Non-canonical forms: uppercase, separators, path traversal, spaces.
    expect(parseCanonicalGameId('Memory')).toBeNull();
    expect(parseCanonicalGameId('memory_match')).toBeNull();
    expect(parseCanonicalGameId('../etc/passwd')).toBeNull();
    expect(parseCanonicalGameId('memory match')).toBeNull();
    expect(parseCanonicalGameId('-memory')).toBeNull();
    expect(parseCanonicalGameId('memory-')).toBeNull();
    expect(parseCanonicalGameId('memory--grid')).toBeNull();
  });

  it('requires registered membership only for the catalog-loading variant', () => {
    registerGameDefinitions([]);
    expect(parseCanonicalGameId('memory')).toBe('memory');
    expect(parseRegisteredGameId('memory')).toBeNull();
  });
});

describe('route input envelope: workout instance keys', () => {
  it('accepts daily and template instance keys', () => {
    expect(parseCanonicalInstanceKey('2026-09-19')).toBe('2026-09-19');
    expect(
      parseCanonicalInstanceKey('2026-09-19::focus-memory::short'),
    ).toBe('2026-09-19::focus-memory::short');
    expect(
      parseCanonicalInstanceKey(['2026-09-19::daily-mix::extended']),
    ).toBe('2026-09-19::daily-mix::extended');
  });

  it('rejects malformed and oversized instance keys', () => {
    expect(parseCanonicalInstanceKey('not-a-date')).toBeNull();
    expect(parseCanonicalInstanceKey('2026-09-19::focus::bogus')).toBeNull();
    expect(parseCanonicalInstanceKey('2026-09-19::focus')).toBeNull();
    expect(parseCanonicalInstanceKey('2026-09-19::focus::short::extra')).toBeNull();
    expect(parseCanonicalInstanceKey('2026-09-19::FOCUS::short')).toBeNull();
    expect(parseCanonicalInstanceKey(OVERSIZED)).toBeNull();
    expect(parseCanonicalInstanceKey(undefined)).toBeNull();
  });
});

describe('route input envelope: workout leg index', () => {
  it('accepts bounded non-negative integer strings', () => {
    expect(parseBoundedLegIndex('0')).toBe(0);
    expect(parseBoundedLegIndex('3')).toBe(3);
    expect(parseBoundedLegIndex(String(MAX_ROUTE_LEG_INDEX))).toBe(
      MAX_ROUTE_LEG_INDEX,
    );
    expect(parseBoundedLegIndex(['2'])).toBe(2);
  });

  it('rejects out-of-bounds, non-integer, and oversized values', () => {
    expect(parseBoundedLegIndex(String(MAX_ROUTE_LEG_INDEX + 1))).toBeNull();
    expect(parseBoundedLegIndex('99999999999999999999')).toBeNull();
    expect(parseBoundedLegIndex('-1')).toBeNull();
    expect(parseBoundedLegIndex('1.5')).toBeNull();
    expect(parseBoundedLegIndex('abc')).toBeNull();
    expect(parseBoundedLegIndex('')).toBeNull();
    expect(parseBoundedLegIndex(undefined)).toBeNull();
    expect(parseBoundedLegIndex(3)).toBeNull();
  });
});

describe('route input envelope: domain and session ids', () => {
  it('accepts canonical domain labels and rejects malformed ones', () => {
    // The production Progress links encode the SDK GameCategory label.
    expect(parseCanonicalDomain('Memory')).toBe('Memory');
    expect(parseCanonicalDomain('Logic & Problem Solving')).toBe(
      'Logic & Problem Solving',
    );
    expect(parseCanonicalDomain('memory')).toBeNull();
    expect(parseCanonicalDomain('Unknown Domain')).toBeNull();
    expect(parseCanonicalDomain(OVERSIZED)).toBeNull();
    expect(parseCanonicalDomain(undefined)).toBeNull();
  });

  it('accepts canonical session ids and rejects malformed ones', () => {
    expect(parseCanonicalSessionId('memory-m9x2k-1-a1b2c3')).toBe(
      'memory-m9x2k-1-a1b2c3',
    );
    expect(parseCanonicalSessionId('session_underscore-ok')).toBe(
      'session_underscore-ok',
    );
    expect(parseCanonicalSessionId('has space')).toBeNull();
    expect(parseCanonicalSessionId('semi;colon')).toBeNull();
    expect(parseCanonicalSessionId(OVERSIZED)).toBeNull();
    expect(parseCanonicalSessionId(undefined)).toBeNull();
  });
});
