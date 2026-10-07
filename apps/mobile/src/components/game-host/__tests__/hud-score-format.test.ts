/**
 * HUD score display-format guard (Campaign 076 certification defect): raw
 * float scores leaked into the stage HUD ("Score 144.1511312699999") while
 * the board readout rounded. The HUD must read an integer for numeric scores
 * and pass any other label through untouched.
 */
import { describe, expect, it } from '@jest/globals';

import { formatHudScore } from '../game-host';

describe('formatHudScore', () => {
  it('rounds numeric scores to integer strings', () => {
    expect(formatHudScore('144.1511312699999')).toBe('144');
    expect(formatHudScore('0.5')).toBe('1');
    expect(formatHudScore('120')).toBe('120');
    expect(formatHudScore('-3.75')).toBe('-4');
  });

  it('passes non-numeric labels through untouched', () => {
    expect(formatHudScore('—')).toBe('—');
    expect(formatHudScore('1,234 pts')).toBe('1,234 pts');
  });
});
