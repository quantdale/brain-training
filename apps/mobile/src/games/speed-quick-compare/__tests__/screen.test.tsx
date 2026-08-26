/**
 * QuickCompareScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the loop: intro → tutorial →
 * active (answer) → feedback → rounds → results → persistence. The dev-only QA
 * force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { quickCompareParamsForLevel } from '../difficulty';
import { generateRound } from '../generator';
import QuickCompareScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { QuickCompareRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const SEED = 'screen-test-seed';
const PARAMS = quickCompareParamsForLevel('normal');
const ROUNDS = PARAMS.rounds;

/** Correct option index for round `roundIndex` of this seed (deterministic). */
function correctIndex(roundIndex: number): number {
  return generateRound(createRng(SEED), roundIndex, PARAMS).correctIndex;
}

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

async function renderScreen(options: { store?: ReturnType<typeof createInMemoryTutorialStore>; persister?: ReturnType<typeof makePersister> } = {}) {
  const clock = createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <QuickCompareScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={persister} />,
  );
  return { clock, store, persister, result };
}

describe('QuickCompareScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro with difficulty options and starts a session', async () => {
    await renderScreen();

    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId(GAME_ID, 'difficulty', level))).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    expect(screen.getByTestId(testId(GAME_ID, 'comparison'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    // Option count follows the prompt type: numeric prompts use the full
    // optionCount (expert = 4); Same/Different rounds stay binary.
    const firstRound = generateRound(createRng(SEED), 0, quickCompareParamsForLevel('expert'));
    for (let i = 0; i < firstRound.optionLabels.length; i += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'option', String(i)))).toBeOnTheScreen();
    }
    expect(screen.queryByTestId(testId(GAME_ID, 'option', String(firstRound.optionLabels.length)))).toBeNull();
  });

  it('opens the tutorial on first play and can skip it', async () => {
    const store = createInMemoryTutorialStore();
    await renderScreen({ store });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('answers a round correctly and advances', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(correctIndex(0)))));

    expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toHaveTextContent('Correct!');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const { persister } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let round = 0; round < ROUNDS; round += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'round', String(round + 1)))).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(correctIndex(round)))));
      expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toBeOnTheScreen();
      if (round < ROUNDS - 1) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next')));
      }
    }

    // last round answered -> feedback; advance to results
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'correct'))).toHaveTextContent(`${ROUNDS}/${ROUNDS}`);

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('speed-quick-compare');
    expect(input.session.rawResult).toBeDefined();
    const raw = input.session.rawResult as QuickCompareRawResult;
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(raw.roundsCorrect).toBe(ROUNDS);
    expect(input.session.normalizedResult).toBe(1); // all correct at reaction 0
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as QuickCompareRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session with every round missed', async () => {
    const { persister } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'correct'))).toHaveTextContent(`0/${ROUNDS}`);
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as QuickCompareRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  // ---- Campaign 011 W05 regressions: the per-round expiry timer had NO
  // coverage at all. These pin the useGameTimeout conversion semantics
  // (W18's flagged risk): deadline resolution, the strict `>` answer
  // boundary, and pause-at-zero resume never losing the expiry.

  it('window expiry resolves the round as a miss ("Too slow")', async () => {
    const { clock } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // normal window is 2600 ms; the scheduled expiry fires on it.
    await act(async () => {
      clock.advance(2_600);
      jest.advanceTimersByTime(2_600);
    });

    expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toHaveTextContent('Too slow');
    // Exactly one miss recorded for round 1.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('an answer exactly AT the deadline counts; the pending expiry cannot double-resolve', async () => {
    const { clock } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Advance only the clock to the deadline — the fake expiry timer has not
    // fired yet, so this races it.
    await act(async () => {
      clock.advance(PARAMS.windowMs);
    });
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(correctIndex(0)))),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toHaveTextContent('Correct!');

    // The expiry timer fires afterwards but is a no-op (round already resolved).
    await act(async () => {
      jest.advanceTimersByTime(PARAMS.windowMs);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toHaveTextContent('Correct!');
  });

  it('an answer strictly AFTER the deadline is ignored and expiry resolves the miss', async () => {
    const { clock } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await act(async () => {
      clock.advance(PARAMS.windowMs + 1); // past the deadline; timer still pending
    });
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(correctIndex(0)))),
    );
    // Late tap rejected — no verdict yet.
    expect(screen.queryByTestId(testId(GAME_ID, 'verdict'))).toBeNull();

    // The expiry then owns the resolution.
    await act(async () => {
      jest.advanceTimersByTime(PARAMS.windowMs + 10);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toHaveTextContent('Too slow');
  });

  it('pausing at zero remaining then resuming still expires promptly (never buys time)', async () => {
    const { clock } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await act(async () => {
      clock.advance(PARAMS.windowMs - 1); // 1 ms of window left
    });

    // Pause captures remaining=1ms and freezes everything.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(`${GAME_ID}.pause-overlay`)).toBeOnTheScreen();
    await act(async () => {
      clock.advance(60_000);
      jest.advanceTimersByTime(60_000);
    });
    // Frozen: paused wall-time must not expire or resolve the round.
    expect(screen.queryByTestId(testId(GAME_ID, 'verdict'))).toBeNull();

    // Resume re-anchors deadline = now + 1ms; the rescheduled 0-ish timeout
    // must still fire (the W18 "0 ms-remaining" edge) instead of being lost.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toHaveTextContent('Too slow');
  });
});
