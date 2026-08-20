/**
 * Cosmetics pure-state tests (engagement-cosmetics wave): ownership
 * derivation for every unlock rule, idempotent grant/equip, and equipped
 * resolution with default fallback.
 */
import { describe, expect, it } from '@jest/globals';

import {
  COSMETIC_DEFINITIONS,
  defaultForSlot,
  equipCosmetic,
  grantOwned,
  isCosmeticOwned,
  resolveEquipped,
} from '@/cosmetics';
import type { CosmeticProgression } from '@/cosmetics';

const PROGRESSION: CosmeticProgression = {
  claimedAchievements: new Set(['ach-25', 'ach-first']),
  claimedQuests: new Set(['qt100']),
  longestStreak: 30,
};

const EMPTY_PROGRESSION: CosmeticProgression = {
  claimedAchievements: new Set(),
  claimedQuests: new Set(),
  longestStreak: 0,
};

describe('isCosmeticOwned', () => {
  it('default cosmetics are always owned', () => {
    const def = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-default')!;
    expect(isCosmeticOwned(def, EMPTY_PROGRESSION, {})).toBe(true);
  });

  it('purchased cosmetics are owned only after grantOwned records them', () => {
    const def = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-azure')!;
    expect(isCosmeticOwned(def, PROGRESSION, {})).toBe(false);
    const withOwned = grantOwned({}, def.id);
    expect(isCosmeticOwned(def, PROGRESSION, withOwned)).toBe(true);
  });

  it('achievement cosmetics unlock when the achievement is claimed', () => {
    const bronze = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-bronze')!;
    const gold = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-gold')!;
    expect(isCosmeticOwned(bronze, PROGRESSION, {})).toBe(true);
    expect(isCosmeticOwned(gold, PROGRESSION, {})).toBe(false);
  });

  it('streak-milestone cosmetics unlock at/after the day threshold', () => {
    const amber = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-accent-amber')!; // 3 days
    const rose = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-accent-rose')!; // 100 days
    expect(isCosmeticOwned(amber, PROGRESSION, {})).toBe(true);
    expect(isCosmeticOwned(rose, PROGRESSION, {})).toBe(false);
    expect(isCosmeticOwned(rose, { ...PROGRESSION, longestStreak: 100 }, {})).toBe(true);
  });
});

describe('grantOwned / equipCosmetic', () => {
  it('grantOwned is idempotent and preserves unrelated keys', () => {
    const def = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-azure')!;
    const once = grantOwned({ theme: 'dark' }, def.id);
    const twice = grantOwned(once, def.id);
    expect((once.cosmetics as Record<string, unknown>).owned).toEqual([def.id]);
    expect(twice).toEqual(once);
  });

  it('equipCosmetic sets the slot and preserves other equipped slots', () => {
    const frame = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-azure')!;
    const equipped = equipCosmetic({ cosmetics: { equipped: { accent: 'cos-accent-emerald' } } }, frame.slot, frame.id);
    const parsed = (equipped.cosmetics as Record<string, unknown>).equipped as Record<string, string>;
    expect(parsed.avatarFrame).toBe('cos-frame-azure');
    expect(parsed.accent).toBe('cos-accent-emerald');
  });
});

describe('resolveEquipped', () => {
  it('falls back to the slot default when nothing is equipped', () => {
    const resolved = resolveEquipped(COSMETIC_DEFINITIONS, {}, EMPTY_PROGRESSION);
    expect(resolved.avatarFrame?.id).toBe(defaultForSlot(COSMETIC_DEFINITIONS, 'avatarFrame')?.id);
    expect(resolved.accent?.id).toBe('cos-accent-indigo');
    expect(resolved.celebration?.id).toBe('cos-celebrate-classic');
  });

  it('keeps an equipped owned cosmetic, but drops one that is no longer owned', () => {
    const settings = {
      cosmetics: {
        owned: ['cos-frame-azure'],
        equipped: { avatarFrame: 'cos-frame-azure', accent: 'cos-accent-rose' },
      },
    };
    // cos-accent-rose requires a 100-day streak (not met) → falls back to default.
    const resolved = resolveEquipped(COSMETIC_DEFINITIONS, settings, EMPTY_PROGRESSION);
    expect(resolved.avatarFrame?.id).toBe('cos-frame-azure');
    expect(resolved.accent?.id).toBe('cos-accent-indigo');
  });
});
