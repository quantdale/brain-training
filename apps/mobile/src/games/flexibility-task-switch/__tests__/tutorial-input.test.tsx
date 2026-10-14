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
    const params = { rounds: 2, switchRate: 1, taskPool: ['parity', 'magnitude'] as const,
    numColors: 3, numShapes: 3, numNumbers: 9, speedTargetMs: 5000 };
  const first = generateRound(rng, 0, null, params);
  const second = generateRound(rng, 1, first.task, params);
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const old = capture('tutorial-grid.option.' + ((first.correctIndex + 1) % first.options.length));
    await press('tutorial-grid.option.' + first.correctIndex);

    await act(async () => old());
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/Task switched/);
    await press('tutorial-grid.option.' + second.correctIndex);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });
});
