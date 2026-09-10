/**
 * OrderSweepScreen regression tests.
 *
 * The game previously had no screen-level suite; this file pins the screen's
 * finalization wiring (the shared rating pipeline reads the persisted
 * `difficulty.challengeRating`, so adaptive sessions must store the computed
 * final challenge, not the SDK baseline).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { ADAPTIVE_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import OrderSweepScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { OrderSweepRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: 0,
  }));
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(seed: string) {
  const clock = createFakeClock(0);
  const persister = makePersister();
  const result = await render(
    <OrderSweepScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={persister}
    />,
  );
  return { clock, persister, result };
}

describe('OrderSweepScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists the final adaptive challenge rating in the session record', async () => {
    // Regression: the record difficulty kept the SDK adaptive baseline (0.5)
    // instead of the computed final rating read by the shared rating pipeline.
    const seed = 'adaptive-rating';
    const { persister } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'adaptive')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // Perfect sweep of round 0: the adaptive window shrinks 8000 → 7250 ms.
    const round = generateRound({
      rng: createRng(seed),
      roundIndex: 0,
      count: ADAPTIVE_PARAMS.count,
      columns: ADAPTIVE_PARAMS.columns,
      maxValue: ADAPTIVE_PARAMS.maxValue,
    });
    for (const value of round.order) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'token', String(value))));
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as OrderSweepRawResult;
    const difficulty = input.session.difficulty as { challengeRating: number };
    // 7250 ms over [4000, 10000], neutral 8000 ms → 0.5 + 0.5·750/4000.
    expect(raw.challengeRating).toBeCloseTo(0.59375);
    expect(difficulty.challengeRating).toBeCloseTo(raw.challengeRating);
  });
});
