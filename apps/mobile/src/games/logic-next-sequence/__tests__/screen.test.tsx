/**
 * LogicScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → question → rounds → results →
 * persistence. Pause freeze semantics (paused time never counts toward a
 * round's response time) and the dev-only QA force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { LOGIC_DIFFICULTY_PARAMS } from '../difficulty';
import { generatePuzzle } from '../generator';
import LogicScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { LogicPuzzle, LogicRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false });
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
    <LogicScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance the fake lifecycle clock (no timers exist in this game). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
  });
}

/** Expected puzzle for a normal (tier 1) round, chaining previous puzzles. */
function normalPuzzle(seed: string, roundIndex: number, prevPuzzle: LogicPuzzle | null) {
  return generatePuzzle({
    rng: createRng(seed),
    roundIndex,
    tier: 1,
    params: LOGIC_DIFFICULTY_PARAMS.normal,
    prevPuzzle,
  });
}

describe('LogicScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'question'))).toBeOnTheScreen();
    // expert: 6 visible terms → chips 0..5, no chip 6.
    expect(screen.getByTestId(testId(GAME_ID, 'sequence', 'term', '5'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'sequence', 'term', '6'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = generatePuzzle({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      tier: 0,
      params: LOGIC_DIFFICULTY_PARAMS.easy,
      prevPuzzle: null,
    });
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(demo.answerIndex))),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(<LogicScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // The help button requests a replay.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('replays the demo after a wrong tap and explains the pattern', async () => {
    await renderScreen({ seed: 'tut-wrong', store: createInMemoryTutorialStore() });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const first = generatePuzzle({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      tier: 0,
      params: LOGIC_DIFFICULTY_PARAMS.easy,
      prevPuzzle: null,
    });
    const wrongIndex = (first.answerIndex + 1) % first.options.length;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-feedback'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-feedback'))).toHaveTextContent(
      /Each step adds/,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-retry')));
    const second = generatePuzzle({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 1,
      tier: 0,
      params: LOGIC_DIFFICULTY_PARAMS.easy,
      prevPuzzle: null,
    });
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(second.answerIndex))),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
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
    expect(screen.getByTestId(testId(GAME_ID, 'question'))).toBeOnTheScreen();

    // normal: 5 rounds, tier 1 (4 visible terms), reference 8000 ms.
    let prev: LogicPuzzle | null = null;
    for (let round = 0; round < 5; round += 1) {
      const puzzle = normalPuzzle(seed, round, prev);
      expect(screen.getByTestId(testId(GAME_ID, 'sequence'))).toBeOnTheScreen();

      await advanceTime(clock, 4000); // active response time per round
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'option', String(puzzle.answerIndex))),
      );

      expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
      expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(
        `Score ${150 * (round + 1)}`,
      );
      expect(screen.getByTestId(testId(GAME_ID, 'pattern-hint'))).toHaveTextContent(
        new RegExp(`^The next term is ${puzzle.answer} — `),
      );

      if (round < 4) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
      prev = puzzle;
    }

    // Final round: the result card's button leads to the results screen.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('5/5');
    expect(screen.getByTestId(testId(GAME_ID, 'fastest-answer'))).toHaveTextContent('4000 ms');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('logic-next-sequence');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(5 * 4000); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as LogicRawResult;
    expect(raw.score).toBe(750); // 5 × 150
    expect(raw.totalMs).toBe(20_000);
    expect(raw.targetMs).toBe(40_000);
    expect(raw.finalTier).toBe(1);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails the round on a wrong answer and continues', async () => {
    const seed = 'wrong-answer';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const first = normalPuzzle(seed, 0, null);
    await advanceTime(clock, 4000);
    const wrongIndex = (first.answerIndex + 1) % first.options.length;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'pattern-hint'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // The next round proceeds normally (fixed levels keep the same tier).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    const second = normalPuzzle(seed, 1, first);
    await advanceTime(clock, 4000);
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(second.answerIndex))),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and paused time never counts as response time', async () => {
    const seed = 'pause-test';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 5000); // active time before pausing

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('logic-next-sequence.pause-overlay')).toBeOnTheScreen();

    // 5000 ms paused: must not advance the response-time clock.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    await advanceTime(clock, 4000);

    // responseMs = 9000 → speed 8000/9000 → bonus round(44.4) = 44 → 144.
    const puzzle = normalPuzzle(seed, 0, null);
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(puzzle.answerIndex))),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 144');
  });

  it('force-win ends the session as a perfect fast run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('5/5');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as LogicRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as LogicRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
