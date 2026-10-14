import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRng, testId } from '@/sdk';
import { Tutorial, TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { generateRound } from '../generator';
import { GAME_ID } from '../types';
function capture(part: string) {
  let fiber = screen.getByTestId(testId(GAME_ID, part)).unstable_fiber;
  while (fiber !== null) {
    if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress as () => void;
    fiber = fiber.return;
  }
  throw new Error('Missing actual tutorial callback');
}
async function press(part: string) { await fireEvent.press(screen.getByTestId(testId(GAME_ID, part))); }
describe('tutorial rendered cue ownership', () => {
  it('rejects the previous demo cue after switching and accepts the actual new cue', async () => {
    const rng = createRng(TUTORIAL_DEMO_SEED);
    const first = generateRound({ rng, roundIndex: 0, rule: 'color', isSwitch: false, numNumbers: 3,
    numShapes: 3, numColors: 3, prevTarget: null });
  const second = generateRound({ rng, roundIndex: 1, rule: 'shape', isSwitch: true, numNumbers: 3,
    numShapes: 3, numColors: 3, prevTarget: first.target });
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const old = capture('tutorial-grid.card.' + first.correctIndex);
    await act(async () => old());
    await press('tutorial-notice-continue');
    await act(async () => old());
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/now match by shape/);
    await press('tutorial-grid.card.' + second.correctIndex);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });
});
