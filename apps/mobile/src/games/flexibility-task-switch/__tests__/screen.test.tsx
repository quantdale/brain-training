/**
 * TaskSwitchScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop:
 * intro → trials (cue + token + answers) → results → persistence. Tutorial
 * open/complete/skip/replay, pause freeze semantics, and the dev-only QA
 * force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { flexibilityTaskSwitchParamsFromProfile, resolveFlexibilityTaskSwitchDifficulty } from '../difficulty';
import { generateRound, generateSession } from '../generator';
import { perfectSessionScore } from '../scoring';
import TaskSwitchScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID, TASK_CUE_WORDS } from '../types';
import type { FlexibilityTaskSwitchRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockRouterBack = jest.fn();

const NORMAL = flexibilityTaskSwitchParamsFromProfile(
  resolveFlexibilityTaskSwitchDifficulty('normal'),
);

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, {
    completed: true,
    replayRequested: false,
    version: '1.0.0',
  });
  return store;
}

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: 0,
    rating: null,
    completionOutcome: null,
  }));
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(
  options: {
    seed?: string;
    store?: ReturnType<typeof createInMemoryTutorialStore>;
    clock?: ReturnType<typeof createFakeClock>;
    persister?: ReturnType<typeof makePersister>;
  } = {},
) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <TaskSwitchScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Replicates the tutorial Demo's two deterministic rounds (parity → magnitude). */
function tutorialDemoRounds() {
  const rng = createRng(TUTORIAL_DEMO_SEED);
  const shared = {
    rounds: 2,
    switchRate: 1,
    taskPool: ['parity', 'magnitude'] as const,
    numColors: 3,
    numShapes: 3,
    numNumbers: 9,
    speedTargetMs: 5000,
  };
  const parity = generateRound(rng, 0, null, shared);
  const magnitude = generateRound(rng, 1, parity.task, shared);
  return { parity, magnitude };
}

async function pressToggleAndForce(action: 'force-win' | 'force-lose') {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, action)));
}

describe('TaskSwitchScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouterBack.mockClear();
    (useRouter as unknown as jest.Mock).mockReturnValue({
      back: mockRouterBack,
      navigate: jest.fn(),
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro with difficulty options and starts a session', async () => {
    await renderScreen({ seed: 'intro' });
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'help'))).toBeOnTheScreen();
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId(GAME_ID, 'difficulty', level))).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const expert = flexibilityTaskSwitchParamsFromProfile(
      resolveFlexibilityTaskSwitchDifficulty('expert'),
    );
    const first = generateSession('intro', expert)[0];
    expect(screen.getByTestId(testId(GAME_ID, 'task-banner'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'token-view'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'task-banner-text'))).toHaveTextContent(
      TASK_CUE_WORDS[first.task],
    );
    // Options match the deterministic plan exactly (order included).
    for (let i = 0; i < first.options.length; i += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'option-grid.option', String(i)))).toHaveTextContent(
        first.options[i],
      );
    }
    expect(screen.queryByTestId(testId(GAME_ID, 'option-grid.option', String(first.options.length)))).toBeNull();
  });

  it('opens the tutorial on first play, completes the demo, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = tutorialDemoRounds();
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      /Is it EVEN or ODD\?/,
    );
    // A wrong pick restarts the demo step without advancing.
    await fireEvent.press(
      screen.getByTestId(
        `${testId(GAME_ID, 'tutorial-grid')}.option.${(demo.parity.correctIndex + 1) % 2}`,
      ),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      /Is it EVEN or ODD\?/,
    );
    await fireEvent.press(
      screen.getByTestId(`${testId(GAME_ID, 'tutorial-grid')}.option.${demo.parity.correctIndex}`),
    );
    // The task switched for the second demo trial.
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      /Is it LOW or HIGH\?/,
    );
    await fireEvent.press(
      screen.getByTestId(`${testId(GAME_ID, 'tutorial-grid')}.option.${demo.magnitude.correctIndex}`),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // Completed: a remount does not auto-open the tutorial…
    await result.unmount();
    await render(
      <TaskSwitchScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // …but help replays it on demand.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('skips the tutorial via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const plan = generateSession(seed, NORMAL);
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    for (let i = 0; i < plan.length; i += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'round', String(i + 1)))).toBeOnTheScreen();
      expect(screen.getByTestId(testId(GAME_ID, 'task-banner-text'))).toHaveTextContent(
        TASK_CUE_WORDS[plan[i].task],
      );
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'option-grid.option', String(plan[i].correctIndex))),
      );
      if (i < plan.length - 1) {
        expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
        // Accrue active lifecycle time during feedback so the run stays
        // perfect: the NEXT trial's response origin resets on transition, so
        // advancing here keeps every answer instant (full speed bonus).
        await advanceTime(clock, 50);
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'switch-accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'xp'))).toHaveTextContent('0');
    expect(screen.queryByTestId(testId(GAME_ID, 'forced-badge'))).toBeNull();

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('flexibility-task-switch');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThan(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBeCloseTo(1);
    const raw = input.session.rawResult as FlexibilityTaskSwitchRawResult;
    expect(raw.score).toBe(perfectSessionScore(NORMAL));
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('shows wrong-answer feedback and continues with the next trial', async () => {
    const seed = 'wrong-answer';
    const plan = generateSession(seed, NORMAL);
    await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const wrongIndex = (plan[0].correctIndex + 1) % plan[0].options.length;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option-grid.option', String(wrongIndex))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-explainer'))).toHaveTextContent(
      new RegExp(plan[0].options[plan[0].correctIndex]),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // The answer grid is replaced by the feedback panel during trialResult,
    // so a stray second pick is impossible at the UI level (the reducer guard
    // is covered in reducer.test.ts).
    expect(screen.queryByTestId(testId(GAME_ID, 'option-grid'))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('pauses: opaque overlay appears, response timing freezes, resume restores the trial', async () => {
    const seed = 'pause-test';
    const plan = generateSession(seed, NORMAL);
    const { clock, persister } = await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    await advanceTime(clock, 100); // active time before pausing
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(`${GAME_ID}.pause-overlay`)).toBeOnTheScreen();

    // Frozen: background time neither advances the trial nor the lifecycle.
    await advanceTime(clock, 10_000);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(`${GAME_ID}.pause-overlay`)).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();

    // The answered trial's response time excludes the paused window
    // (100 ms pre-pause): score = 100 + 50 × (1 − 100/4500) ≈ 148.89.
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option-grid.option', String(plan[0].correctIndex))),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(/Score 148\.8/);

    // Finish via QA and confirm the persisted durations exclude the pause.
    await pressToggleAndForce('force-win');
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    await act(async () => {});
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.durationMs).toBe(100);
    const raw = input.session.rawResult as FlexibilityTaskSwitchRawResult;
    expect(raw.diagnosticMetadata.pausedDurationMs).toBe(10_000);
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await pressToggleAndForce('force-win');

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as FlexibilityTaskSwitchRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBeCloseTo(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await pressToggleAndForce('force-lose');

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('0%');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as FlexibilityTaskSwitchRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('surfaces persistence failures without crashing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failing = makePersister();
    failing.completeSession.mockImplementation(async () => {
      throw new Error('db down');
    });
    await renderScreen({ seed: 'persist-fail', persister: failing });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await pressToggleAndForce('force-win');
    await act(async () => {});

    expect(screen.getByTestId(testId(GAME_ID, 'persist-error'))).toHaveTextContent(/db down/);
    errorSpy.mockRestore();
  });

  it('restarts a fresh session from results and quits back to the library', async () => {
    const { persister, result } = await renderScreen({ seed: 'restart' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await pressToggleAndForce('force-win');
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();

    await pressToggleAndForce('force-win');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'quit')));
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    await result.unmount();
  });

  it('never marks any option as selected while the trial is active', async () => {
    await renderScreen({ seed: 'no-leak' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const plan = generateSession('no-leak', NORMAL);
    for (let i = 0; i < plan[0].options.length; i += 1) {
      const option = screen.getByTestId(testId(GAME_ID, 'option-grid.option', String(i)));
      expect(option.props.accessibilityState?.selected ?? false).toBe(false);
    }
  });
});
