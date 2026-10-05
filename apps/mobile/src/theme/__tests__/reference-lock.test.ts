/**
 * Reference-lock contract (change 076, task 3.1).
 *
 * Pins the Training-Studio token decisions that the rest of the reboot leans
 * on: the CTA-red role discipline, the studio neutrals, the 800-weight type
 * hierarchy and the quiet elevation ramp. The generic contrast guarantees are
 * covered by `contrast.test.ts`; this file pins the LOCK-specific values so a
 * future palette edit cannot silently drift away from the selected direction.
 */

import { describe, expect, it } from '@jest/globals';

import { Colors, Elevation, Families, Typography } from '@/theme/tokens';

describe('reference lock (Training Studio, 076 REFERENCE_LOCK.md)', () => {
  it('uses the locked studio neutrals in both schemes', () => {
    expect(Colors.light.background).toBe('#F7F6F3');
    expect(Colors.light.surface).toBe('#FFFFFF');
    expect(Colors.light.text).toBe('#17181A');
    expect(Colors.light.textMuted).toBe('#6E6E68');
    expect(Colors.dark.background).toBe('#101114');
    expect(Colors.dark.surface).toBe('#1B1D21');
    expect(Colors.dark.text).toBe('#F2F2F0');
    expect(Colors.dark.textMuted).toBe('#9A9A94');
  });

  it('keeps the CTA red as the action role with its locked values', () => {
    expect(Families.light.accent.base).toBe('#D6293A');
    expect(Families.light.accent.on).toBe('#FFFFFF');
    expect(Colors.light.accentStrong).toBe('#B01E2E');
    expect(Families.dark.accent.base).toBe('#FF4A57');
    expect(Colors.dark.accentStrong).toBe('#FF6E79');
  });

  it('keeps success and danger distinct from the CTA red', () => {
    // The red CTA must never be mistaken for the error family: the error base
    // differs per scheme and the success family is green in both.
    expect(Families.light.danger.base).not.toBe(Families.light.accent.base);
    expect(Families.dark.danger.base).not.toBe(Families.dark.accent.base);
    expect(Families.light.success.base).toBe('#157A46');
    expect(Families.dark.success.base).toBe('#4CC98A');
  });

  it('caps the type hierarchy at weight 800 and locks the display numerals', () => {
    for (const token of Object.values(Typography)) {
      expect(Number(token.weight)).toBeLessThanOrEqual(800);
    }
    expect(Typography.numeralXl.size).toBe(54);
    expect(Typography.title.size).toBe(30);
    expect(Typography.eyebrow.tracking).toBe(1.8);
  });

  it('keeps the elevation ramp quiet: cards are flat, only raised/hero lift', () => {
    expect(Elevation.card.boxShadow).toBe('none');
    expect(Elevation.card.elevation).toBe(0);
    expect(Elevation.raised.elevation).toBeGreaterThan(0);
    expect(Elevation.hero.elevation).toBeGreaterThan(Elevation.raised.elevation);
  });
});
