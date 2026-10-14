import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { createRng, testId } from '@/sdk';
import { Tutorial, TUTORIAL_DEMO_SEED, TUTORIAL_DEMO_PARAMS } from '../components/tutorial';
import { GAME_ID } from '../types';
import { generateRound } from '../generator';
function round(_attempt = 0) {
  return generateRound({ rng: createRng(TUTORIAL_DEMO_SEED), roundIndex: 0,
    params: TUTORIAL_DEMO_PARAMS, prevRound: null });
}
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
async function solve() { await press('tutorial-next'); await press('option.' + round().correctIndex); }
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
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toBeNull();
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

  it('keeps the first choice when wrong and correct native callbacks arrive in one batch', async () => {
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const wrong = capture('option.' + ((round().correctIndex + 1) % round().options.length));
    const correct = capture('option.' + round().correctIndex);
    await act(async () => { wrong(nativeInput()); correct(nativeInput()); });
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-done'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-retry'))).toBeOnTheScreen();
  });

  it('retires the old attempt after retry and accepts the new displayed answer', async () => {
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const old = capture('option.' + round().correctIndex);
    await press('option.' + ((round().correctIndex + 1) % round().options.length));
    await press('tutorial-retry');
    await act(async () => old(nativeInput()));
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-done'))).toBeNull();
    await press('option.' + round(1).correctIndex);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });

  it('rejects a physical delivery reused on a fresh attempt while a new delivery works', async () => {
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const wrong = capture('option.' + ((round().correctIndex + 1) % round().options.length));
    const event = nativeInput();
    await act(async () => wrong(event));
    await press('tutorial-retry');
    const fresh = capture('option.' + round(1).correctIndex);
    await act(async () => fresh(event));
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-done'))).toBeNull();
    await act(async () => fresh(nativeInput()));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });

});
