import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { createRng, testId } from '@/sdk';
import { Tutorial, TUTORIAL_DEMO_SEED, TUTORIAL_DEMO_PARAMS } from '../components/tutorial';
import { GAME_ID } from '../types';
import { generateSessionProblems } from '../generator';
const problems = generateSessionProblems(createRng(TUTORIAL_DEMO_SEED), TUTORIAL_DEMO_PARAMS);
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
async function solve() { await press('tutorial-next');
  for (const problem of problems) {
    for (const d of String(problem.answer)) await press('digit.' + d);
    await press('submit');
  } }
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

  it('claims a correct Submit before duplicate native delivery can skip past the two demo problems', async () => {
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    for (const d of String(problems[0].answer)) await press('digit.' + d);
    const submit = capture('submit');
    const event = nativeInput();
    await act(async () => { submit(event); submit(event); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/Solve 1 more problem/);
    for (const d of String(problems[1].answer)) await press('digit.' + d);
    await press('submit');
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });

  it('stages distinct rapid digits before a same-batch submit', async () => {
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const digits = String(problems[0].answer).split('').map(d => capture('digit.' + d));
    const submit = capture('submit');
    await act(async () => { digits.forEach(digit => digit(nativeInput())); submit(nativeInput()); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/Solve 1 more problem/);
  });

  it('rejects an old demo digit after the second problem becomes visible', async () => {
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const old = capture('digit.1');
    for (const d of String(problems[0].answer)) await press('digit.' + d);
    await press('submit');
    await act(async () => old(nativeInput()));
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent('?');
    await press('digit.2');
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent('2');
  });

  it('consumes a physical digit once but preserves a distinct repeated digit', async () => {
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const digit = capture('digit.1');
    const event = nativeInput();
    await act(async () => { digit(event); digit(event); });
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent('1');
    await act(async () => digit(nativeInput()));
    expect(screen.getByTestId(testId(GAME_ID, 'answer-input'))).toHaveTextContent('11');
  });

});
