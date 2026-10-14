import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Tutorial } from '../components/tutorial';

describe('Grid Navigator tutorial reachability', () => {
  it('bounds the long demo in an explicit scroll viewport', async () => {
    await render(<Tutorial onComplete={() => {}} />);
    await fireEvent.press(screen.getByTestId('spatial-grid-nav.tutorial-next'));
    const scroll = screen.getByTestId('spatial-grid-nav.tutorial-scroll');
    const style = StyleSheet.flatten(scroll.props.style);
    expect(style.height).toBeGreaterThan(0);
    expect(style.height).toBeLessThanOrEqual(600);
  });

  it('keeps each answer miniature bounded rather than growing to the full board width', async () => {
    await render(<Tutorial onComplete={() => {}} />);
    await fireEvent.press(screen.getByTestId('spatial-grid-nav.tutorial-next'));
    for (let i = 0; i < 3; i += 1) {
      const option = screen.getByTestId(`spatial-grid-nav.option.${i}`);
      const style = StyleSheet.flatten(option.props.style);
      expect(style.width).toBeGreaterThanOrEqual(48);
      expect(style.width).toBeLessThanOrEqual(112);
    }
  });

  it('completes the actual command demo through a normal answer and Done', async () => {
    const onComplete = jest.fn();
    await render(<Tutorial onComplete={onComplete} />);
    await fireEvent.press(screen.getByTestId('spatial-grid-nav.tutorial-next'));
    // (2,2), facing north: forward, right, forward, forward => (1,4).
    await fireEvent.press(screen.getByRole('button', { name: /Option \d+, cell row 2 column 5$/ }));
    expect(screen.getByText("You've got it")).toBeOnTheScreen();
    expect(onComplete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('spatial-grid-nav.tutorial-done'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
