import { describe, expect, it } from '@jest/globals';

import { nativeTabLabelFontSize } from '@/components/app-tabs';
import { Typography } from '@/theme/tokens';

describe('native tab label sizing', () => {
  it('keeps normal system text on the shared caption scale', () => {
    expect(nativeTabLabelFontSize(1)).toBe(Typography.caption.size);
    expect(nativeTabLabelFontSize(1.4)).toBe(Typography.caption.size);
  });

  it('caps fixed four-item chrome at large system text', () => {
    expect(nativeTabLabelFontSize(1.5)).toBe(9);
    expect(nativeTabLabelFontSize(2)).toBe(9);
  });
});
