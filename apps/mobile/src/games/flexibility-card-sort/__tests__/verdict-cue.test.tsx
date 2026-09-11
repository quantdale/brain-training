/**
 * Card-sort verdict-cue tests (PATTERNS-PLAY 6–7, FEEDBACK-CHOREOGRAPHY).
 *
 * A wrong sort must mark the picked card wrong (danger fill + ✕ + "Wrong
 * pick" label) AND the correct card correct (success fill + ✓ + "Correct"
 * label) together, while the rule prompt stays visible through feedback.
 */
import { describe, expect, it, jest, afterEach, beforeEach } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { generateRound, pickInitialRule } from '../generator';
import { flexibilityParamsForLevel } from '../difficulty';
import CardSortScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

function makePersister(): SessionPersistence {
  const completeSession = jest.fn(
    async (input: CompleteSessionInput) => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
    }),
  );
  return { completeSession } as unknown as SessionPersistence;
}

async function renderScreen(seed: string) {
  const clock = createFakeClock(0);
  const result = await render(
    <CardSortScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  return { clock, result };
}

async function startEasyRound(seed: string) {
  await renderScreen(seed);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  const params = flexibilityParamsForLevel('easy');
  const rule = pickInitialRule(createRng(seed));
  const round = generateRound({
    rng: createRng(seed),
    roundIndex: 0,
    rule,
    numShapes: params.numShapes,
    numColors: params.numColors,
    prevTarget: null,
  });
  return round;
}

const gridCard = (grid: string, index: number) => testId(GAME_ID, grid, `card.${index}`);
const verdictBadge = (grid: string, index: number) =>
  screen.getByTestId(`${gridCard(grid, index)}.verdict`, { includeHiddenElements: true });

describe('CardSortScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the wrong pick AND the correct card together, keeping the rule prompt visible', async () => {
    const round = await startEasyRound('verdict-wrong');
    const wrongIndex = (round.correctIndex + 1) % round.candidates.length;

    // The live score readout is visible during play.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(gridCard('card-grid', wrongIndex)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    // Prompt (rule banner) stays visible during feedback.
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner'))).toBeOnTheScreen();

    const wrongCard = screen.getByTestId(gridCard('round-result-grid', wrongIndex));
    const correctCard = screen.getByTestId(gridCard('round-result-grid', round.correctIndex));

    expect(wrongCard.props.accessibilityLabel).toMatch(/^Wrong pick:/);
    expect(correctCard.props.accessibilityLabel).toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', wrongIndex)).toHaveTextContent('✕');
    expect(verdictBadge('round-result-grid', round.correctIndex)).toHaveTextContent('✓');

    // The wrong answer must not read as correct through any channel.
    expect(wrongCard.props.accessibilityLabel).not.toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', wrongIndex)).not.toHaveTextContent('✓');
  });

  it('marks a correct sort with the correct cue', async () => {
    const round = await startEasyRound('verdict-correct');

    await fireEvent.press(screen.getByTestId(gridCard('card-grid', round.correctIndex)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    const correctCard = screen.getByTestId(gridCard('round-result-grid', round.correctIndex));
    expect(correctCard.props.accessibilityLabel).toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', round.correctIndex)).toHaveTextContent('✓');
  });
});
