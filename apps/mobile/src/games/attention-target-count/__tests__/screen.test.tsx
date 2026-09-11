// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TargetCountScreen from '../screen';
import { GAME_ID } from '../types';
import type { TargetCountRound } from '../types';
import { TARGET_COUNT_DIFFICULTY_PARAMS, escalatedDistractorClasses } from '../difficulty';
import { generateRound } from '../generator';
import type { SessionPersistence } from '../session';
import type { CompleteSessionInput, CompleteSessionResult } from '@/db';
import {
  createInMemoryTutorialStore,
  createRng,
  noopAudioHaptics,
  setLiveAudioHaptics,
  testId,
} from '@/sdk';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

/** Replicate the reducer's deterministic round generation to know correct
 *  answers. Assumes the all-correct playback the callers drive, so the
 *  within-session distractor ladder escalates exactly like the reducer's. */
function sessionRounds(seed: string, level: keyof typeof TARGET_COUNT_DIFFICULTY_PARAMS = 'normal'): TargetCountRound[] {
  const rng = createRng(seed);
  const params = TARGET_COUNT_DIFFICULTY_PARAMS[level];
  const rounds: TargetCountRound[] = [];
  let prev = null as TargetCountRound | null;
  let streak = 0;
  for (let r = 0; r < params.rounds; r += 1) {
    const round = generateRound({
      rng,
      roundIndex: r,
      params: { ...params, distractorClasses: escalatedDistractorClasses(params, streak) },
      prevRound: prev,
    });
    rounds.push(round);
    prev = round;
    streak += 1;
  }
  return rounds;
}

describe('TargetCountScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the intro screen with difficulty buttons', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'screen'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'hard'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert'))).toBeTruthy();
  });

  it('selects difficulty and starts a session', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'show-grid'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'grid'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'target-prompt'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'count-options'))).toBeTruthy();
  });

  it('pressing the correct count shows a correct round result', async () => {
    const rounds = sessionRounds('test-seed', 'normal');
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(rounds[0].targetCount))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'actual-count'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeTruthy();
  });

  it('pressing a wrong count shows a wrong round result', async () => {
    const rounds = sessionRounds('test-seed', 'normal');
    const correct = rounds[0].targetCount;
    const wrong = rounds[0].options.find((o) => o !== correct) ?? -1;
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(wrong))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeTruthy();
  });

  it('drives a full session to results and finalizes', async () => {
    const rounds = sessionRounds('full-seed', 'normal'); // matches the default 'normal' difficulty
    let resolvePersist: (r: CompleteSessionResult) => void = () => {};
    const persistSession: SessionPersistence = {
      completeSession: jest.fn(
        () =>
          new Promise<CompleteSessionResult>((res) => {
            resolvePersist = res;
          }),
      ),
    };
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="full-seed"
        persistSession={persistSession}
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let r = 0; r < rounds.length; r += 1) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(rounds[r].targetCount))));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-correct'))).toBeTruthy();

    // Resolve persistence and let the success dispatch land inside act.
    await act(async () => {
      resolvePersist({
        session: {} as never,
        ledgerEntry: null,
        balance: 0,
        rating: null,
        completionOutcome: null,
      });
      await Promise.resolve();
    });
  });

  it('shows QA panel in dev mode', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'qa-toggle'))).toBeTruthy();
  });

  it('opens tutorial', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeTruthy();
  });

  it('pausing freezes the round window and resume continues the remainder', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="pause-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'show-grid'))).toBeTruthy();

    // Partway into the normal-level round window (9000ms).
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(testId(GAME_ID, 'pause-overlay'))).toBeTruthy();

    // Frozen: background time must not expire the round while paused (the
    // board itself is hidden from the accessibility tree, so assertions
    // resume before querying game content).
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    // Resume: only the remaining ~6000ms of active time may elapse before the
    // round times out (a pre-fix bug restarted the FULL window on resume).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5900);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'show-grid'))).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId(testId(GAME_ID, 'show-grid'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeTruthy();
  });

  it('plays wrong feedback for a wrong answer and correct feedback for a right answer', async () => {
    const sfx: string[] = [];
    const haptics: string[] = [];
    setLiveAudioHaptics({
      ...noopAudioHaptics,
      playSfx: (name) => sfx.push(name),
      haptic: (type) => haptics.push(type),
    });
    try {
      const rounds = sessionRounds('sfx-seed', 'normal');
      await render(
        <TargetCountScreen
          tutorialStore={completedStore()}
          sessionSeed="sfx-seed"
        />,
      );
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

      // Wrong pick: must play the WRONG sound (a pre-fix bug always played
      // the correct sound regardless of the answer).
      const correct0 = rounds[0].targetCount;
      const wrong = rounds[0].options.find((o) => o !== correct0) ?? -1;
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(wrong))));
      expect(sfx).toEqual(['memory-tile-wrong']);
      expect(haptics).toEqual(['warning']);

      // Correct pick on the next round: correct sound + light haptic.
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'count-option', String(rounds[1].targetCount))),
      );
      expect(sfx).toEqual(['memory-tile-wrong', 'memory-tile-correct']);
      expect(haptics).toEqual(['warning', 'light']);
    } finally {
      setLiveAudioHaptics(noopAudioHaptics);
    }
  });

  it('restart after a QA-forced round-1 loss restarts the full round window', async () => {
    const persistSession: SessionPersistence = {
      completeSession: jest.fn(async () => ({
        session: {} as never,
        ledgerEntry: null,
        balance: 0,
        rating: null,
        completionOutcome: null,
      })),
    };
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="restart-ref"
        persistSession={persistSession}
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeTruthy();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    expect(screen.getByTestId(testId(GAME_ID, 'show-grid'))).toBeTruthy();
    // 6000ms into a fresh normal-level window (9000ms) the round must still be
    // live; the pre-fix accumulator carried 3000ms over from before the restart.
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'show-grid'))).toBeTruthy();
  });
  it('persists the final adaptive challenge rating in the session record', async () => {
    // Regression: the record difficulty kept the SDK adaptive baseline (0.5)
    // instead of the computed final challenge rating.
    const persistSession: SessionPersistence = {
      completeSession: jest.fn(async (input: CompleteSessionInput) => ({
        session: input.session,
        ledgerEntry: null,
        balance: 0,
        rating: null,
        completionOutcome: null,
      })),
    };
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="adaptive-rating"
        persistSession={persistSession}
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'adaptive')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});

    const completeSession = persistSession.completeSession as jest.Mock;
    expect(completeSession).toHaveBeenCalledTimes(1);
    const input = completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as { challengeRating: number };
    const difficulty = input.session.difficulty as { challengeRating: number };
    expect(difficulty.challengeRating).toBeCloseTo(raw.challengeRating);
    expect(difficulty.challengeRating).not.toBe(0.5);
  });

  it('a wrong pick marks the picked value and the correct value together', async () => {
    const rounds = sessionRounds('test-seed', 'normal');
    const correct = rounds[0].targetCount;
    const wrong = rounds[0].options.find((o) => o !== correct) ?? -1;
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(wrong))));
    // Both verdicts stay visible together: ✕ on the pick, ✓ on the answer.
    // Badges are decorative (hidden from the a11y tree); the words channel
    // is asserted through the accessible names below.
    expect(
      screen.getByTestId(testId(GAME_ID, 'count-option', String(wrong), 'verdict'), {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByTestId(testId(GAME_ID, 'count-option', String(correct), 'verdict'), {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.getByLabelText(`Wrong pick: ${wrong}`)).toBeTruthy();
    expect(screen.getByLabelText(`Correct: ${correct}`)).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'picked-count'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'actual-count'))).toBeTruthy();
    // The prompt stays mounted beside the verdict.
    expect(screen.getByTestId(testId(GAME_ID, 'target-prompt'))).toBeTruthy();
  });

  it('a tap after the round timed out stays silent and keeps the timeout verdict', async () => {
    const sfx: string[] = [];
    setLiveAudioHaptics({
      ...noopAudioHaptics,
      playSfx: (name) => sfx.push(name),
      haptic: () => {},
    });
    try {
      const rounds = sessionRounds('test-seed', 'normal');
      await render(
        <TargetCountScreen
          tutorialStore={completedStore()}
          sessionSeed="test-seed"
        />,
      );
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
      await act(async () => {
        jest.advanceTimersByTime(9200);
      });
      expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeTruthy();
      // Late tap on the (now disabled) correct option: ignored and silent.
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'count-option', String(rounds[0].targetCount))),
      );
      expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeTruthy();
      expect(sfx).toEqual([]);
      // The correct value is still revealed for review.
      expect(
        screen.getByTestId(testId(GAME_ID, 'count-option', String(rounds[0].targetCount), 'verdict'), {
          includeHiddenElements: true,
        }),
      ).toBeTruthy();
    } finally {
      setLiveAudioHaptics(noopAudioHaptics);
    }
  });
});
