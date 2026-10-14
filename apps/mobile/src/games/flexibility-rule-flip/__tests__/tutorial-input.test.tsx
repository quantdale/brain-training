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
describe('tutorial retry ownership', () => {
  it('requires a fresh callback after retrying the identical displayed demo', async () => {
    const round = generateRound({ rng: createRng(TUTORIAL_DEMO_SEED), roundIndex: 0, rule: 'color',
      isSwitch: false, numNumbers: 3, numShapes: 3, numColors: 3, prevTarget: null });
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const old = capture('tutorial-grid.card.' + round.correctIndex);
    await press('tutorial-grid.card.' + ((round.correctIndex + 1) % 4));
    await press('tutorial-demo-retry');
    await act(async () => old());
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-demo-done'))).toBeNull();
    await press('tutorial-grid.card.' + round.correctIndex);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-done'))).toBeOnTheScreen();
  });

  it('claims the first demo choice before a distinct native callback in the same batch', async () => {
    const round = generateRound({ rng: createRng(TUTORIAL_DEMO_SEED), roundIndex: 0, rule: 'color',
      isSwitch: false, numNumbers: 3, numShapes: 3, numColors: 3, prevTarget: null });
    await render(<Tutorial onComplete={jest.fn()} />);
    await press('tutorial-next');
    const correct = capture('tutorial-grid.card.' + round.correctIndex);
    const wrong = capture('tutorial-grid.card.' + ((round.correctIndex + 1) % 4));
    await act(async () => { correct(); wrong(); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-done'))).toBeOnTheScreen();
  });
});
