/**
 * Campaign 023 gamification surfaces: StreakCard, LevelCard, FeedbackCard,
 * and the ProgressTrack tone contract. Presentational tests only — data
 * authority stays with the callers and is covered by the module tests.
 */
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { FeedbackCard, LevelCard, StreakCard } from '../index';

describe('StreakCard', () => {
  it('renders the streak count, weekly tracker, and an accessible summary', async () => {
    const { getByText, getByTestId, getByLabelText } = await render(
      <StreakCard
        current={3}
        activityDates={['2026-09-11', '2026-09-10', '2026-09-09']}
        coveredDates={[]}
        today="2026-09-11"
      />,
    );

    expect(getByText('3')).toBeTruthy();
    expect(getByText('day streak')).toBeTruthy();
    expect(getByTestId('home-streak-card-tracker')).toBeTruthy();
    expect(getByLabelText(/3 day streak/)).toBeTruthy();
    expect(getByLabelText(/3 active days in the last week/)).toBeTruthy();
  });

  it('renders the at-risk nudge only when flagged', async () => {
    const { queryByTestId, rerender } = await render(
      <StreakCard current={3} activityDates={[]} today="2026-09-11" />,
    );
    expect(queryByTestId('home-streak-at-risk')).toBeNull();

    await rerender(
      <StreakCard current={3} activityDates={[]} today="2026-09-11" atRisk />,
    );
    expect(queryByTestId('home-streak-at-risk')).toBeTruthy();
  });
});

describe('LevelCard', () => {
  it('shows level, XP total, and XP-to-next wording from the shared helpers', async () => {
    const { getByText, getByTestId } = await render(
      <LevelCard totalXp={150} level={2} coins={0} />,
    );

    expect(getByTestId('home-stat-level')).toBeTruthy();
    expect(getByTestId('home-stat-xp')).toBeTruthy();
    expect(getByText('Level 2')).toBeTruthy();
    expect(getByText(/150 XP/)).toBeTruthy();
    expect(getByText(/XP to Level 3/)).toBeTruthy();
  });

  it('hides the coin chip at zero balance and shows it otherwise', async () => {
    const { queryByTestId, rerender } = await render(
      <LevelCard totalXp={0} level={1} coins={0} />,
    );
    expect(queryByTestId('home-stat-coins')).toBeNull();

    await rerender(<LevelCard totalXp={0} level={1} coins={12} />);
    expect(queryByTestId('home-stat-coins')).toBeTruthy();
  });
});

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
