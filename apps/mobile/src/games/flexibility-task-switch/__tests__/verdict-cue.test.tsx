/**
 * Task-switch verdict-cue tests (PATTERNS-PLAY 6–7, FEEDBACK-CHOREOGRAPHY).
 *
 * A wrong pick must mark the picked option wrong (danger fill + ✕ + "Wrong
 * pick" label) AND the correct option correct (success fill + ✓ + "Correct"
 * label) together, while the task cue and the token stay visible through
 * feedback.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { flexibilityTaskSwitchParamsFromProfile, resolveFlexibilityTaskSwitchDifficulty } from '../difficulty';
import { generateSession } from '../generator';
import TaskSwitchScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID, TASK_CUE_WORDS } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = flexibilityTaskSwitchParamsFromProfile(
  resolveFlexibilityTaskSwitchDifficulty('normal'),
);

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
    <TaskSwitchScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={seed}
      persistSession={persister}
    />,
  );
  return { clock, store, persister };
}

async function startSession(seed: string) {
  await renderScreen(seed);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return generateSession(seed, NORMAL);
}

const resultOption = (index: number) =>
  testId(GAME_ID, 'round-result-grid', `option.${index}`);
const verdictBadge = (index: number) =>
  screen.getByTestId(`${resultOption(index)}.verdict`, { includeHiddenElements: true });

describe('TaskSwitchScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the wrong pick AND the correct option together, keeping cue and token visible', async () => {
    const plan = await startSession('verdict-wrong');
    const wrongIndex = (plan[0].correctIndex + 1) % plan[0].options.length;

    // The live score readout is visible during play.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option-grid.option', String(wrongIndex))),
    );

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    // Task cue and token stay visible during feedback.
    expect(screen.getByTestId(testId(GAME_ID, 'task-banner'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'task-banner-text'))).toHaveTextContent(
      TASK_CUE_WORDS[plan[0].task],
    );
    expect(screen.getByTestId(testId(GAME_ID, 'token-view'))).toBeOnTheScreen();
    // The live answer grid stays unmounted so a stray second pick is impossible.
    expect(screen.queryByTestId(testId(GAME_ID, 'option-grid'))).toBeNull();

    const wrongOption = screen.getByTestId(resultOption(wrongIndex));
    const correctOption = screen.getByTestId(resultOption(plan[0].correctIndex));

    expect(wrongOption.props.accessibilityLabel).toMatch(/^Wrong pick:/);
    expect(correctOption.props.accessibilityLabel).toMatch(/^Correct:/);
    expect(verdictBadge(wrongIndex)).toHaveTextContent('✕');
    expect(verdictBadge(plan[0].correctIndex)).toHaveTextContent('✓');

    // The wrong answer must not read as correct through any channel.
    expect(wrongOption.props.accessibilityLabel).not.toMatch(/^Correct:/);
    expect(verdictBadge(wrongIndex)).not.toHaveTextContent('✓');
  });

  it('marks a correct pick with the correct cue, cue and token still visible', async () => {
    const plan = await startSession('verdict-correct');

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option-grid.option', String(plan[0].correctIndex))),
    );

    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'task-banner-text'))).toHaveTextContent(
      TASK_CUE_WORDS[plan[0].task],
    );
    expect(screen.getByTestId(testId(GAME_ID, 'token-view'))).toBeOnTheScreen();
    const correctOption = screen.getByTestId(resultOption(plan[0].correctIndex));
    expect(correctOption.props.accessibilityLabel).toMatch(/^Correct:/);
    expect(verdictBadge(plan[0].correctIndex)).toHaveTextContent('✓');
  });
});
