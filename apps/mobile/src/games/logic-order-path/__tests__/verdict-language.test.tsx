/**
 * OrderPath verdict-language tests.
 *
 * The shared verdict vocabulary on the round-result panel: correct/wrong/
 * timeout map onto fill + glyph + wording, the clue stem stays mounted while
 * feedback shows, the wrong pick is named next to the solution, and the
 * score reads out through the animated counter.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { FakeClock } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { ORDER_PATH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import type { OrderPathRound } from '../types';
import OrderPathScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = ORDER_PATH_DIFFICULTY_PARAMS.normal;
const BUDGET_MS = NORMAL.roundTimeMs;

/** Tutorial store that already completed the tutorial (skips first-play). */
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
  await render(
    <OrderPathScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  return { clock };
}

/** Advance both the fake lifecycle clock and the round-expiry timer (RNTL act is async). */
async function advanceTime(clock: FakeClock, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Reproduce the reducer's deterministic round chain for a seed. */
function sessionRounds(
  seed: string,
  count: number,
  params: { itemCount: number; edgeDensityTarget: number } = NORMAL,
): OrderPathRound[] {
  const rounds: OrderPathRound[] = [];
  let prev: readonly string[] | null = null;
  for (let roundIndex = 0; roundIndex < count; roundIndex += 1) {
    const round = generateRound({
      rng: createRng(seed),
      roundIndex,
      itemCount: params.itemCount,
      edgeDensityTarget: params.edgeDensityTarget,
      prevSolution: prev,
    });
    rounds.push(round);
    prev = round.solution;
  }
  return rounds;
}

/** Place every item of the current round in its unique valid order. */
async function solveCurrentRound(round: OrderPathRound) {
  for (const item of round.solution) {
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'item', item)));
  }
}

describe('OrderPathScreen verdict language', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('solving a round shows the success verdict panel with the solution', async () => {
    const seed = 'verdict-solve';
    await renderScreen(seed);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const first = sessionRounds(seed, 1)[0];

    await solveCurrentRound(first);

    const panel = screen.getByTestId(testId(GAME_ID, 'round-verdict'));
    expect(panel).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, 'round-verdict-glyph'), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent('✓');
    expect(screen.getByTestId(testId(GAME_ID, 'round-solution'))).toHaveTextContent(
      `Solution: ${first.solution.join(' → ')}`,
    );
    // The clue stem stays mounted while feedback shows.
    expect(screen.getByText('Clues')).toBeOnTheScreen();
  });

  it('names the wrong pick next to the solution on a miss', async () => {
    const seed = 'verdict-wrong';
    await renderScreen(seed);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const first = sessionRounds(seed, 1)[0];
    const badItem = first.items.find((item) => item !== first.solution[0])!;

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'item', badItem)));

    const panel = screen.getByTestId(testId(GAME_ID, 'round-verdict'));
    expect(panel).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, 'round-verdict-glyph'), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent('✕');
    // Wrong pick and correct solution visible together, in words.
    expect(screen.getByTestId(testId(GAME_ID, 'wrong-pick'))).toHaveTextContent(
      `Your last pick: ${badItem}`,
    );
    expect(screen.getByLabelText(`Wrong pick: ${badItem}`)).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-solution'))).toBeOnTheScreen();
    // Item buttons stay unmounted once the round is resolved.
    expect(screen.queryByTestId(testId(GAME_ID, 'item', badItem))).toBeNull();
  });

  it('uses the timeout verdict when the deadline wins', async () => {
    const seed = 'verdict-timeout';
    const { clock } = await renderScreen(seed);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    await advanceTime(clock, BUDGET_MS);

    const panel = screen.getByTestId(testId(GAME_ID, 'round-verdict'));
    expect(panel).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, 'round-verdict-glyph'), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent('⏱');
  });

  it('shows the animated live score while the session runs', async () => {
    await renderScreen('verdict-score');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const live = screen.getByTestId(testId(GAME_ID, 'score-live'));
    expect(live).toBeOnTheScreen();
    expect(live).toHaveTextContent('0');
  });
});
