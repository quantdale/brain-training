/**
 * Spatial verdict-cue tests (PATTERNS-PLAY 6–7, FEEDBACK-CHOREOGRAPHY).
 *
 * A wrong pick must mark the tapped option wrong (danger fill + ✕ + "wrong
 * pick" label) AND the correct option correct (success fill + ✓ + "correct"
 * label) together, while the choice prompt stays visible through feedback.
 */
import { describe, expect, it, jest, afterEach, beforeEach } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { generateRoundData } from '../generator';
import { DIFFICULTY_PARAMS } from '../difficulty';
import SpatialTransformMatchScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const SOURCE_REVEAL_MS = 1500;

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
  await render(
    <SpatialTransformMatchScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  return { clock };
}

async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Start a session and wait out the source reveal so the choice board is live. */
async function startChoice(seed: string) {
  const { clock } = await renderScreen(seed);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  await advanceTime(clock, SOURCE_REVEAL_MS);
  expect(screen.getByTestId(testId(GAME_ID, 'choice-status'))).toBeOnTheScreen();
  const params = DIFFICULTY_PARAMS.normal;
  const side = Math.round(Math.sqrt(params.gridSize));
  return generateRoundData({
    rng: createRng(seed),
    roundIndex: 0,
    gridSize: params.gridSize,
    side,
    filledCells: params.filledCells,
    allowedTransforms: params.allowedTransforms,
    optionCount: params.optionCount,
    prevSource: null,
    prevTransform: null,
  });
}

const optionId = (index: number) => testId(GAME_ID, 'option', String(index));
const verdictBadge = (index: number) =>
  screen.getByTestId(testId(GAME_ID, 'option-verdict', String(index)), {
    includeHiddenElements: true,
  });

describe('SpatialTransformMatchScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the wrong pick AND the correct option together, keeping the prompt visible', async () => {
    const roundData = await startChoice('spatial-verdict-wrong');
    const wrongIndex = (roundData.correctOptionIndex + 1) % roundData.options.length;

    // The live score readout is visible during play.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(optionId(wrongIndex)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    // Prompt (choice stem) stays visible during feedback.
    expect(screen.getByTestId(testId(GAME_ID, 'choice-status'))).toBeOnTheScreen();

    const wrongOption = screen.getByTestId(optionId(wrongIndex));
    const correctOption = screen.getByTestId(optionId(roundData.correctOptionIndex));

    expect(wrongOption.props.accessibilityLabel).toBe(`Option ${wrongIndex + 1}, wrong pick`);
    expect(correctOption.props.accessibilityLabel).toBe(
      `Option ${roundData.correctOptionIndex + 1}, correct`,
    );
    expect(verdictBadge(wrongIndex)).toHaveTextContent('✕');
    expect(verdictBadge(roundData.correctOptionIndex)).toHaveTextContent('✓');

    // The wrong answer must not read as correct through any channel.
    expect(wrongOption.props.accessibilityLabel).not.toMatch(/correct/);
    expect(verdictBadge(wrongIndex)).not.toHaveTextContent('✓');
  });

  it('marks a correct pick with the correct cue', async () => {
    const roundData = await startChoice('spatial-verdict-correct');

    await fireEvent.press(screen.getByTestId(optionId(roundData.correctOptionIndex)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    const correctOption = screen.getByTestId(optionId(roundData.correctOptionIndex));
    expect(correctOption.props.accessibilityLabel).toBe(
      `Option ${roundData.correctOptionIndex + 1}, correct`,
    );
    expect(verdictBadge(roundData.correctOptionIndex)).toHaveTextContent('✓');
  });
});
