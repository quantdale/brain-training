/**
 * Reference-lock contract (change 077, evidence/ART_DIRECTION.md).
 *
 * Pins the selected cool canvas, blue interaction role, bundled readable type
 * hierarchy and quiet elevation ramp. The generic contrast guarantees are
 * covered by `contrast.test.ts`; this file pins the LOCK-specific values so a
 * future palette edit cannot silently drift away from the selected direction.
 */

import { describe, expect, it } from '@jest/globals';

import { contrastRatio } from '@/theme/contrast';

import { Colors, Elevation, Families, Fonts, Radii, Typography } from '@/theme/tokens';

describe('reference lock (Play Lab, 077 ART_DIRECTION.md)', () => {
  it('uses cool canvas and navy ink in both schemes', () => {
    expect(Colors.light.background).toBe('#F6F7FB');
    expect(Colors.light.surface).toBe('#FFFFFF');
    expect(Colors.light.text).toBe('#17243B');
    expect(Colors.light.textMuted).toBe('#5C6A80');
    expect(Colors.light.stage).toBe('#172132');
    expect(Colors.light.stageInk).toBe('#FFFFFF');
    expect(Colors.dark.background).toBe('#0D1728');
    expect(Colors.dark.surface).toBe('#172132');
    expect(Colors.dark.text).toBe('#F3F6FC');
    expect(Colors.dark.textMuted).toBe('#A4B2C7');
    expect(Colors.dark.stage).toBe('#172132');
  });

  it('keeps blue as the interaction role with theme-aware on-fill ink', () => {
    expect(Families.light.accent.base).toBe('#0061EF');
    expect(Families.light.accent.on).toBe('#FFFFFF');
    expect(Colors.light.accentStrong).toBe('#004FC7');
    expect(Families.dark.accent.base).toBe('#8DBBFF');
    expect(Families.dark.accent.on).toBe('#0C2343');
    expect(Colors.dark.accentStrong).toBe('#B2D2FF');
  });

  it('keeps success and danger distinct from the interaction family', () => {
    expect(Families.light.danger.base).not.toBe(Families.light.accent.base);
    expect(Families.dark.danger.base).not.toBe(Families.dark.accent.base);
    expect(Families.light.success.base).toBe('#157A46');
    expect(Families.dark.success.base).toBe('#4CC98A');
  });

  it('uses bundled regular/semibold/bold type and restrained headings', () => {
    for (const token of Object.values(Typography)) {
      expect(['400', '600', '700']).toContain(token.weight);
    }
    expect(Fonts.sans).toBe('Manrope');
    expect(Typography.body.weight).toBe('400');
    expect(Typography.numeralXl.size).toBe(48);
    expect(Typography.title.size).toBe(28);
    expect(Typography.eyebrow.tracking).toBe(0.6);
    expect(Radii.medium).toBe(8);
  });

  it('keeps the elevation ramp quiet: cards are flat, only raised/hero lift', () => {
    expect(Elevation.card.boxShadow).toBe('none');
    expect(Elevation.card.elevation).toBe(0);
    expect(Elevation.raised.elevation).toBeGreaterThan(0);
    expect(Elevation.hero.elevation).toBeGreaterThan(Elevation.raised.elevation);
  });
});

describe('stage pairings (preserved contrast contract)', () => {
  const STAGE_TEXT_MIN = 4.5;

  it('verifies every stage text role against the stage panel in both schemes', () => {
    const violations: string[] = [];
    for (const scheme of ['light', 'dark'] as const) {
      const stage = Colors[scheme].stage;
      for (const role of ['stageInk', 'stageWarn', 'stageError', 'stageMuted'] as const) {
        const ratio = contrastRatio(Colors[scheme][role], stage);
        if (ratio < STAGE_TEXT_MIN) {
          violations.push(
            `${scheme} ${role} on stage: ${Colors[scheme][role]} = ${ratio.toFixed(2)}:1 (min ${STAGE_TEXT_MIN})`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps the light-scheme semantic families OFF the stage (they fail on charcoal)', () => {
    // Regression pin for the review finding: light danger (2.13:1) and light
    // warning (2.28:1) must not be used as text on the stage panel — the
    // stageWarn/stageError pairings exist for that.
    expect(contrastRatio(Colors.light.danger, Colors.light.stage)).toBeLessThan(4.5);
    expect(contrastRatio(Colors.light.warning, Colors.light.stage)).toBeLessThan(4.5);
  });
});
