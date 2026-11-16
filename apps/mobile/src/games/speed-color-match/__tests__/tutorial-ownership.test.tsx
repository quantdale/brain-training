import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { testId } from '@/sdk';
import { Tutorial } from '../components/tutorial';
import { GAME_ID } from '../types';
import type { ColorName } from '../types';
let mockGrid: ComponentProps<typeof import('../components/color-button').ColorButtonGrid>;
let mockColor: ColorName;
jest.mock('../components/color-button', () => {
  const actual = jest.requireActual<typeof import('../components/color-button')>('../components/color-button');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, ColorButtonGrid: (props: typeof mockGrid) => { mockGrid = props; return React.createElement(actual.ColorButtonGrid, props); } };
});
jest.mock('../components/swatch', () => {
  const actual = jest.requireActual<typeof import('../components/swatch')>('../components/swatch');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, ColorSwatch: (props: ComponentProps<typeof actual.ColorSwatch>) => { mockColor = props.swatchColor; return React.createElement(actual.ColorSwatch, props); } };
});
async function mount() {
  const result = await render(<Tutorial onComplete={jest.fn()} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
  return result;
}
describe('Color Match tutorial trial ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });
  it.each([2, 3])('claims the trial once for %i queued correct deliveries and retires its callback', async (count) => {
    await mount();
    const old = mockGrid.onPress;
    const color = mockColor;
    await act(async () => { for (let i = 0; i < count; i += 1) old(color); });
    await act(async () => jest.advanceTimersByTime(800));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/2 left/);
    await act(async () => old(color));
    await act(async () => jest.advanceTimersByTime(800));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/2 left/);
    await act(async () => mockGrid.onPress(mockColor));
    await act(async () => jest.advanceTimersByTime(800));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/1 left/);
    await act(async () => mockGrid.onPress(mockColor));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });
  it('retires callbacks on wrong-attempt remount and on unmount, clearing its owned timer', async () => {
    const timeout = jest.spyOn(global, 'setTimeout');
    const clear = jest.spyOn(global, 'clearTimeout');
    const result = await mount();
    const old = mockGrid.onPress;
    const color = mockColor;
    await act(async () => old(color === 'red' ? 'blue' : 'red'));
    await act(async () => old(color));
    await act(async () => jest.advanceTimersByTime(800));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/3 left/);
    await act(async () => mockGrid.onPress(mockColor));
    const pending = mockGrid.onPress;
    const advanceIndex = timeout.mock.calls.findLastIndex((call) => call[1] === 800);
    expect(advanceIndex).toBeGreaterThanOrEqual(0);
    const advance = timeout.mock.calls[advanceIndex][0] as () => void;
    const timer = timeout.mock.results[advanceIndex].value;
    await result.unmount();
    expect(clear).toHaveBeenCalledWith(timer);
    const scheduled = timeout.mock.calls.filter((call) => call[1] === 800).length;
    await act(async () => { pending(mockColor); advance(); });
    expect(timeout.mock.calls.filter((call) => call[1] === 800)).toHaveLength(scheduled);
    timeout.mockRestore();
    clear.mockRestore();
    await act(async () => jest.advanceTimersByTime(800));
  });
});
