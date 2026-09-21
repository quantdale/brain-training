/**
 * DifficultySelector accessibility — the difficulty chips must present as a
 * radio group whose children carry the `radio` role and truthful selection,
 * not as unrelated buttons inside a radiogroup. Guards the Campaign 067
 * hardening fix (was `radiogroup` > unlabelled-relationship `button`s).
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DifficultySelector } from '@/components/game-ui';

const LEVELS = ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const;

describe('DifficultySelector accessibility', () => {
  it('exposes a labelled radiogroup with radio children', async () => {
    await render(<DifficultySelector gameId="memory" selected="normal" onSelect={() => {}} />);
    const group = screen.getByLabelText('Difficulty');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    for (const level of LEVELS) {
      expect(screen.getByTestId(`memory.difficulty.${level}`).props.accessibilityRole).toBe('radio');
    }
  });

  it('marks exactly the selected difficulty and reports the chosen level', async () => {
    const onSelect = jest.fn();
    await render(<DifficultySelector gameId="memory" selected="hard" onSelect={onSelect} />);
    expect(screen.getByTestId('memory.difficulty.hard').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('memory.difficulty.easy').props.accessibilityState).toMatchObject({
      selected: false,
    });
    await fireEvent.press(screen.getByTestId('memory.difficulty.expert'));
    expect(onSelect).toHaveBeenCalledWith('expert');
  });
});
