import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import * as themeHook from '@/hooks/use-theme';
import { contrastRatio } from '@/theme/contrast';
import { FeedbackPegs } from '../components/feedback-pegs';
import { Tutorial } from '../components/tutorial';

afterEach(() => { jest.restoreAllMocks(); });

describe('Code Cracker readable feedback', () => {
  it.each(['light', 'dark'] as const)('keeps exact and outline pegs visible in %s mode with written counts', async (mode) => {
    jest.spyOn(themeHook, 'useTheme').mockReturnValue(Colors[mode]);
    await render(<FeedbackPegs feedback={{ exact: 2, colorOnly: 1 }} testID="feedback" />);
    const exact = StyleSheet.flatten(screen.getAllByTestId('feedback.exact')[0].props.style);
    const colorOnly = StyleSheet.flatten(screen.getByTestId('feedback.color-only').props.style);
    expect(contrastRatio(exact.backgroundColor, Colors[mode].surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colorOnly.borderColor, Colors[mode].surface)).toBeGreaterThanOrEqual(3);
    expect(exact.backgroundColor).not.toBe(colorOnly.backgroundColor);
    expect(screen.getByText('2 exact · 1 color only')).toBeTruthy();
    expect(screen.getByLabelText('2 exact, 1 color only')).toBeTruthy();
  });

  it('shows zero matches in words instead of an empty feedback row', async () => {
    await render(<FeedbackPegs feedback={{ exact: 0, colorOnly: 0 }} testID="feedback" />);
    expect(screen.getByText('0 exact · 0 color only')).toBeTruthy();
  });

  it('lets the player inspect tutorial feedback before continuing', async () => {
    await render(<Tutorial onComplete={() => {}} />);
    await fireEvent.press(screen.getByTestId('logic-code-cracker.tutorial-next'));
    for (let peg = 0; peg < 3; peg += 1) {
      await fireEvent.press(screen.getByTestId('logic-code-cracker.color.0'));
    }
    await fireEvent.press(screen.getByTestId('logic-code-cracker.tutorial-submit'));
    expect(screen.getByText(/\d exact · \d color only/)).toBeTruthy();
    expect(screen.queryByTestId('logic-code-cracker.tutorial-done')).toBeNull();
  });
});
