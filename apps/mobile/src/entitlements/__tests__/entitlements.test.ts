import { describe, expect, it } from '@jest/globals';

import { createLocalDefaultEntitlementProvider } from '../local-provider';
import { isUsable, resolveEntitlement, resolveEntitlements } from '../resolve';
import type { EntitlementProvider, FeatureEntitlement } from '../types';
import { ENTITLEMENTS_SEAM_VERSION } from '../types';

describe('local default entitlement provider', () => {
  it('grants every known feature, unmetered, from the local default source', () => {
    const provider = createLocalDefaultEntitlementProvider();
    for (const entitlement of provider.resolveAll()) {
      expect(entitlement.granted).toBe(true);
      expect(entitlement.source).toBe('local-default');
      expect(entitlement.remainingUses).toBeNull();
    }
  });

  it('resolves deterministically: repeated calls are deep-equal and cover ALL_FEATURE_KEYS order', () => {
    const provider = createLocalDefaultEntitlementProvider();
    const a = provider.resolveAll();
    const b = provider.resolveAll();
    expect(a).toEqual(b);
    // Default argument resolves exactly the canonical key list, in order.
    expect(a.map((e) => e.feature)).toEqual([
      'training',
      'cosmetics',
      'data-portability',
      'ai-assistant',
    ]);
  });
});

describe('isUsable', () => {
  it('denies ungranted or exhausted entitlements and allows unmetered/positive ones', () => {
    const base: FeatureEntitlement = {
      feature: 'ai-assistant',
      granted: true,
      source: 'purchase',
      remainingUses: null,
    };
    expect(isUsable(base)).toBe(true);
    expect(isUsable({ ...base, granted: false })).toBe(false);
    expect(isUsable({ ...base, remainingUses: 0 })).toBe(false);
    expect(isUsable({ ...base, remainingUses: 2 })).toBe(true);
  });
});

describe('provider seam', () => {
  it('lets a custom provider answer through the same resolve API', () => {
    // Minimal stand-in for a future real provider (see types.ts plug-in note).
    const custom: EntitlementProvider = {
      id: 'test-provider',
      resolve: (feature) => ({
        feature,
        granted: feature !== 'cosmetics',
        source: 'subscription',
        remainingUses: feature === 'ai-assistant' ? 3 : null,
      }),
      resolveAll: (features) =>
        (features ?? ['training']).map((f) => custom.resolve(f)),
    };
    expect(resolveEntitlement(custom, 'cosmetics').granted).toBe(false);
    expect(isUsable(resolveEntitlement(custom, 'ai-assistant'))).toBe(true);
    expect(resolveEntitlements(custom, ['training']).length).toBe(1);
    expect(ENTITLEMENTS_SEAM_VERSION).toBe('1.0.0');
  });
});
