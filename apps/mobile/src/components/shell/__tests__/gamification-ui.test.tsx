/**
 * Campaign 023 gamification surfaces: FeedbackCard and the ProgressTrack tone
 * contract (header corrected 2026-10-02: StreakCard and LevelCard were deleted
 * by Change 071 and their cases with them). Presentational tests only — data
 * authority stays with the callers and is covered by the module tests.
 */
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { FeedbackCard } from '../index';

describe('FeedbackCard', () => {
  it('renders emoji, title, and detail with a polite live region', async () => {
    const { getByText, getByTestId } = await render(
      <FeedbackCard
        tone="success"
        emoji="🎉"
        title="+30 XP earned!"
        detail="+2 coins · Progress saved"
        testID="reward-card"
      />,
    );

    expect(getByText('🎉')).toBeTruthy();
    expect(getByText('+30 XP earned!')).toBeTruthy();
    expect(getByText('+2 coins · Progress saved')).toBeTruthy();
    expect(getByTestId('reward-card').props.accessibilityLiveRegion).toBe('polite');
  });
});
