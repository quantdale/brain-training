/**
 * Pure-logic tests for the W14 a11y primitives (campaign 010).
 *
 * Only the deterministic helpers are covered here — component semantics are
 * guarded by the existing RNTL contract suites (`game-ui/__tests__`,
 * `components/__tests__/shell-a11y`). No mounting, no device.
 */
import { describe, expect, it } from '@jest/globals';

import { BOARD_GLYPH_FONT_SCALE, MAX_FONT_SCALE, effectiveFontScale } from '@/components/a11y/font-scale';
import { motionValue, reduceDuration } from '@/components/a11y/reduced-motion';
import { formatResultSummary } from '@/components/a11y/result-feedback';
import { formatStats } from '@/components/a11y/stats';

describe('effectiveFontScale', () => {
  it('caps oversized system scales at MAX_FONT_SCALE', () => {
    expect(effectiveFontScale(2.0)).toBe(MAX_FONT_SCALE);
    expect(effectiveFontScale(3.2)).toBe(MAX_FONT_SCALE);
  });

  it('clamps sub-normal scales up to 1 and passes mid-range through', () => {
    expect(effectiveFontScale(0.8)).toBe(1);
    expect(effectiveFontScale(1.2)).toBe(1.2);
    // Custom cap for special surfaces (e.g. board glyphs never scale).
    expect(effectiveFontScale(1.5, BOARD_GLYPH_FONT_SCALE)).toBe(1);
  });
});

describe('motionValue / reduceDuration', () => {
  it('picks the static fallback under reduced motion and the animated value otherwise', () => {
    expect(motionValue(true, 0.96, 1)).toBe(1);
    expect(motionValue(false, 0.96, 1)).toBe(0.96);
  });

  it('collapses decorative durations to zero under reduced motion only', () => {
    expect(reduceDuration(true, 250)).toBe(0);
    expect(reduceDuration(false, 250)).toBe(250);
  });
});

describe('formatStats', () => {
  it('joins label/value pairs into one spoken summary, skipping empty values', () => {
    expect(
      formatStats([
        ['Score', '750'],
        ['Accuracy', '100%'],
      ]),
    ).toBe('Score 750. Accuracy 100%');
  });

  it('omits empty metrics so optional rows produce no fragments', () => {
    expect(
      formatStats([
        ['Score', '750'],
        ['Best streak', ''],
      ]),
    ).toBe('Score 750');
    expect(formatStats([])).toBe('');
  });
});

describe('formatResultSummary', () => {
  it('combines headline and detail, or returns a trimmed headline alone', () => {
    expect(formatResultSummary('Session complete', 'Score 750, new personal best')).toBe(
      'Session complete. Score 750, new personal best',
    );
    expect(formatResultSummary('  Round passed  ')).toBe('Round passed');
    expect(formatResultSummary('Session complete', '   ')).toBe('Session complete');
  });
});
