/**
 * `announce()` contract (campaign 011 W14).
 *
 * 071: the `LiveRegion` render cases were removed with the component. What
 * remains is the one contract that still ships: the imperative announcement is
 * a guarded pass-through, and whitespace-only copy is dropped rather than
 * queued as a silent utterance.
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { AccessibilityInfo } from 'react-native';

import { announce } from '@/components/a11y/announcements';

describe('announce', () => {
  let announceSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined as unknown as void);
  });

  afterEach(() => {
    announceSpy.mockRestore();
  });

  it('posts the message to the platform announcer', () => {
    announce('Round passed');
    expect(announceSpy).toHaveBeenCalledWith('Round passed');
  });

  it('drops empty and whitespace-only messages', () => {
    announce('');
    announce('   ');
    expect(announceSpy).not.toHaveBeenCalled();
  });
});
