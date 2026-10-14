import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { testId } from '@/sdk';
import { Tutorial } from '../components/tutorial';
import { GAME_ID } from '../types';


function capture(part: string) {
  let fiber = screen.getByTestId(testId(GAME_ID, part)).unstable_fiber;
  while (fiber !== null) {
    const onPress = fiber.memoizedProps?.onPress;
    if (typeof onPress === 'function') return onPress as (event?: GestureResponderEvent) => void;
    fiber = fiber.return;
  }
  throw new Error('Missing actual native callback: ' + part);
}
async function press(part: string) { await fireEvent.press(screen.getByTestId(testId(GAME_ID, part))); }
function nativeInput() { return { nativeEvent: {} } as GestureResponderEvent; }
async function solve() { await press('tutorial-next'); }
describe('tutorial native input ownership', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('preserves normal public controls through a single completion', async () => {
    const complete = jest.fn();
    await render(<Tutorial onComplete={complete} />);
    await solve();
    await press('tutorial-done');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('completes only once even before the parent unmounts the tutorial', async () => {
    const complete = jest.fn();
    await render(<Tutorial onComplete={complete} />);
    await solve();
    const done = capture('tutorial-done');
    await act(async () => { done(nativeInput()); done(nativeInput()); });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('skips only once and retires a queued intro control', async () => {
    const skip = jest.fn();
    await render(<Tutorial onComplete={jest.fn()} onSkip={skip} />);
    const next = capture('tutorial-next');
    const oldSkip = capture('tutorial-skip');
    await act(async () => { oldSkip(nativeInput()); oldSkip(nativeInput()); next(nativeInput()); });
    expect(skip).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-done'))).toBeNull();
  });

  it('retires completion after the tutorial unmounts', async () => {
    const complete = jest.fn();
    const tree = await render(<Tutorial onComplete={complete} />);
    await solve();
    const old = capture('tutorial-done');
    await tree.unmount();
    await act(async () => old(nativeInput()));
    expect(complete).not.toHaveBeenCalled();
  });

});
