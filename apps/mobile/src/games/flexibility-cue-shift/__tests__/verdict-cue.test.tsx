/**
 * Cue-shift verdict-cue tests (PATTERNS-PLAY 6–7, FEEDBACK-CHOREOGRAPHY).
 *
 * A wrong pick must mark the picked card wrong (danger fill + ✕ + "Wrong
 * pick" label) AND the correct card correct (success fill + ✓ + "Correct"
 * label) together, while the cue prompt stays visible through feedback.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { flexibilityCueParamsForLevel } from '../difficulty';
import { generateSession } from '../generator';
import CueShiftScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID, RULE_LABELS } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(
    async (input: CompleteSessionInput) => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
    }),
  );
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(seed: string) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  await render(
    <CueShiftScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={seed}
      persistSession={persister}
    />,
  );
  return { clock, store, persister };
}

async function startEasyRound(seed: string) {
  await renderScreen(seed);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return generateSession(seed, flexibilityCueParamsForLevel('easy'));
}

const gridCard = (grid: string, index: number) => testId(GAME_ID, grid, `card.${index}`);
const verdictBadge = (grid: string, index: number) =>
  screen.getByTestId(`${gridCard(grid, index)}.verdict`, { includeHiddenElements: true });

describe('CueShiftScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the wrong pick AND the correct card together, keeping the cue visible', async () => {
    const rounds = await startEasyRound('verdict-wrong');
    const wrongIndex = (rounds[0].correctIndex + 1) % rounds[0].candidates.length;

    // The live score readout is visible during play.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(gridCard('card-grid', wrongIndex)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    // Cue prompt stays visible during feedback.
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[rounds[0].rule],
    );

    const wrongCard = screen.getByTestId(gridCard('round-result-grid', wrongIndex));
    const correctCard = screen.getByTestId(gridCard('round-result-grid', rounds[0].correctIndex));

    expect(wrongCard.props.accessibilityLabel).toMatch(/^Wrong pick:/);
    expect(correctCard.props.accessibilityLabel).toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', wrongIndex)).toHaveTextContent('✕');
    expect(verdictBadge('round-result-grid', rounds[0].correctIndex)).toHaveTextContent('✓');

    // The wrong answer must not read as correct through any channel.
    expect(wrongCard.props.accessibilityLabel).not.toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', wrongIndex)).not.toHaveTextContent('✓');
  });

  it('marks a correct pick with the correct cue and keeps the cue visible', async () => {
    const rounds = await startEasyRound('verdict-correct');

    await fireEvent.press(screen.getByTestId(gridCard('card-grid', rounds[0].correctIndex)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[rounds[0].rule],
    );
    const correctCard = screen.getByTestId(gridCard('round-result-grid', rounds[0].correctIndex));
    expect(correctCard.props.accessibilityLabel).toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', rounds[0].correctIndex)).toHaveTextContent('✓');
  });
});
