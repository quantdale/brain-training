/**
 * OrderPathScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → rounds (place every item in the unique order) →
 * results → persistence. Round timeout, pause-freeze semantics and the
 * dev-only QA force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { ORDER_PATH_DIFFICULTY_PARAMS, orderPathParamsForLevel } from '../difficulty';
import { generateRound } from '../generator';
import type { OrderPathRound , OrderPathRawResult } from '../types';
import OrderPathScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = ORDER_PATH_DIFFICULTY_PARAMS.normal;
const BUDGET_MS = NORMAL.roundTimeMs;
/** Time "spent" per round in the full-session test (drives the speed bonus). */
const ANSWER_MS = 500;

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

async function renderScreen(options: {
  seed?: string;
  store?: ReturnType<typeof createInMemoryTutorialStore>;
  clock?: ReturnType<typeof createFakeClock>;
  persister?: ReturnType<typeof makePersister>;
} = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <OrderPathScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the round-expiry timer (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
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

describe('OrderPathScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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

    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    // Exactly `itemCount` item buttons are offered (6 for expert).
    const expertItems = sessionRounds('intro', 1, orderPathParamsForLevel('expert'))[0].items;
    for (const item of expertItems) {
      expect(screen.getByTestId(testId(GAME_ID, 'item', item))).toBeOnTheScreen();
    }
    // The first solution item is available; nothing is placed yet.
    expect(screen.queryByTestId(testId(GAME_ID, 'placed', '0'))).toBeNull();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(<OrderPathScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // The help button requests a replay.
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
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const rounds = sessionRounds(seed, NORMAL.rounds);
    for (let index = 0; index < rounds.length; index += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'round', String(index + 1)))).toBeOnTheScreen();

      // Spend some active time, then place every item in the unique order.
      await advanceTime(clock, ANSWER_MS);
      await solveCurrentRound(rounds[index]);
      expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();

      if (index < rounds.length - 1) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-correct'))).toHaveTextContent('5/5');
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    // Per round: 100 + round(50 * (1 - 500/25000)) = 149.
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(String(5 * 149));
    expect(screen.getByTestId(testId(GAME_ID, 'best-time'))).toHaveTextContent('0.5s');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('logic-order-path');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(rounds.length * ANSWER_MS); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    // accuracy 1 × (0.5 + 0.5 × (1 − (2500/125000)/5)) = 0.998
    expect(input.session.normalizedResult).toBeCloseTo(0.998);
    const raw = input.session.rawResult as OrderPathRawResult;
    expect(raw.score).toBe(5 * 149);
    expect(raw.bestRoundTimeMs).toBe(ANSWER_MS);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('ends a round as wrong on a bad pick, reveals the solution, and continues', async () => {
    const seed = 'wrong-pick';
    const { persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const first = sessionRounds(seed, 1)[0];
    const badItem = first.items.find((item) => item !== first.solution[0])!;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'item', badItem)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    // Post-round feedback may reveal the answer; item buttons are gone.
    expect(screen.getByTestId(testId(GAME_ID, 'round-result'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'item', badItem))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();

    // Finish the session so the raw result can be checked.
    const rounds = sessionRounds(seed, NORMAL.rounds);
    for (let index = 1; index < rounds.length; index += 1) {
      await solveCurrentRound(rounds[index]);
      if (index < rounds.length - 1) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-correct'))).toHaveTextContent('4/5');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as OrderPathRawResult).roundsCorrect).toBe(4);
  });

  it('times out via the round timer at the budget boundary', async () => {
    const { clock } = await renderScreen({ seed: 'timeout-tick' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, BUDGET_MS);
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and the round budget freezes until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 1_000);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(`${GAME_ID}.pause-overlay`)).toBeOnTheScreen();

    // Frozen: background time must not consume the round budget.
    await advanceTime(clock, 5_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();

    // The full remaining budget (24000ms after 1000ms used) is still required.
    await advanceTime(clock, BUDGET_MS - 1_000 - 1);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    await advanceTime(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as OrderPathRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-correct'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as OrderPathRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('force-timeout expires only the current round (dev QA path)', async () => {
    await renderScreen({ seed: 'qa-timeout' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-timeout')));

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  // ---- Campaign 011 W05 regressions (W18's flagged expiry edge after the
  // useGameTimeout conversion): the deadline boundary is strict `>` and a
  // late tap never steals the resolution from the expiry timer.

  it('a round solved exactly AT the deadline still counts (strict > boundary)', async () => {
    const seed = 'deadline-boundary';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const first = sessionRounds(seed, 1)[0];
    // Advance only the clock TO the deadline — the fake expiry timer has not
    // fired yet, so this races it.
    await act(async () => {
      clock.advance(BUDGET_MS);
    });
    // Place the full solution; every pick stamps nowMs === deadlineMs, which
    // the guards must accept (only strictly-after is rejected).
    await solveCurrentRound(first);
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();

    // The pending expiry timer fires afterwards but is a no-op (round already
    // resolved) — no double resolution.
    await act(async () => {
      jest.advanceTimersByTime(BUDGET_MS);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
  });

  it('a pick strictly AFTER the deadline is ignored; expiry owns the resolution', async () => {
    const seed = 'late-pick';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const first = sessionRounds(seed, 1)[0];
    // Move past the deadline WITHOUT advancing fake timers: the expiry
    // dispatch is still pending, so this races it.
    await act(async () => {
      clock.advance(BUDGET_MS + 1);
    });
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'item', first.solution[0])),
    );
    // The late pick was rejected — no round outcome yet.
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();

    // The expiry timer then resolves the round as a timeout.
    await act(async () => {
      jest.advanceTimersByTime(BUDGET_MS + 10);
    });
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    // Exactly one resolution: stats show a single played/failed round.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');
  });
});
