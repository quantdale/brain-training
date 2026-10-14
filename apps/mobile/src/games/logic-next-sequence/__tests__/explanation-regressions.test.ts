import { describe, expect, it } from '@jest/globals';

import { describePattern, solveSequence } from '../generator';

describe('Next in Sequence interleaved explanation', () => {
  it('explains the two position streams that produce the displayed answer', () => {
    const pattern = solveSequence([10, 11, 13, 12, 16, 13])!;
    expect(pattern.family).toBe('alternating');
    expect(pattern.next).toBe(19);
    expect(describePattern(pattern.family, pattern.params)).toBe(
      'Two sequences interleave: positions 1, 3, 5… add 3; positions 2, 4, 6… add 1.',
    );
  });
});
