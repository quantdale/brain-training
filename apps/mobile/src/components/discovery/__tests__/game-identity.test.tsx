import type { ReactElement } from 'react';

import { describe, expect, it } from '@jest/globals';

import { registry } from '@/registry/registry.generated';

import {
  GAME_IDENTITIES,
  IDENTITY_FAMILY_LABELS,
  IdentityMark,
  getGameIdentity,
  type GameIdentityFamily,
} from '../game-identity';

const EXPECTED_FAMILIES: readonly GameIdentityFamily[] = [
  'attention-visual-search',
  'memory-recall',
  'speed-reaction',
  'math-structured-input',
  'language-association-context',
  'logic-deduction',
  'flexibility-rule-switching',
  'spatial-transformation',
];

describe('catalog game identity', () => {
  it('covers every generated catalog id exactly once', () => {
    const registryIds = registry.map((game) => game.id).sort();
    const identityIds = Object.keys(GAME_IDENTITIES).sort();

    expect(registryIds).toHaveLength(42);
    expect(identityIds).toEqual(registryIds);
    expect(new Set(identityIds).size).toBe(42);
  });

  it('uses all eight mechanic families with complete copy', () => {
    const families = new Set(Object.values(GAME_IDENTITIES).map((identity) => identity.family));

    expect([...families].sort()).toEqual([...EXPECTED_FAMILIES].sort());
    for (const identity of Object.values(GAME_IDENTITIES)) {
      expect(IDENTITY_FAMILY_LABELS[identity.family]).toBeTruthy();
      expect(identity.motif).toBeTruthy();
      expect(identity.verb).toMatch(/\S/);
      expect(identity.interaction).toMatch(/[.!?]$/);
    }
  });

  it('resolves by stable id and preserves fixture descriptions as a safe fallback', () => {
    const visualSearch = getGameIdentity(registry.find((game) => game.id === 'attention-visual-search')!);
    expect(visualSearch.family).toBe('attention-visual-search');
    expect(visualSearch.verb).toBe('Find');

    const fixture = getGameIdentity({
      id: 'fixture-memory',
      name: 'Fixture Memory',
      primaryCategory: 'Memory',
      description: 'Remember this fixture.',
    });
    expect(fixture.family).toBe('memory-recall');
    expect(fixture.interaction).toBe('Remember this fixture.');
  });

  it('keeps the family mark decorative for assistive technology', () => {
    const element = IdentityMark({
      family: 'logic-deduction',
      size: 36,
      color: '#123456',
      testID: 'identity',
    }) as ReactElement<{
      accessible?: boolean;
      importantForAccessibility?: string;
      testID?: string;
    }>;
    expect(element.props.accessible).toBe(false);
    expect(element.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(element.props.testID).toBe('identity');
  });
});

