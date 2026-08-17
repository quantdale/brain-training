/**
 * SequenceMemoryScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → reveal → input → rounds → time-up →
 * results → persistence. Pause freeze semantics (including the score-attack
 * budget), countdown rendering, and the dev-only QA force paths are covered
 * too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { generateSequence } from '../generator';
import SequenceMemoryScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { SequenceMemoryRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const REVEAL_MS = 900;
const NORMAL_BUDGET_MS = 90_000;

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
    <SequenceMemoryScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the reveal/countdown timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Reveal the current round fully (one advance per tile; timers chain per flush). */
async function revealRound(clock: ReturnType<typeof createFakeClock>, length: number) {
  for (let tick = 0; tick < length; tick += 1) {
    await advanceTime(clock, REVEAL_MS);
  }
}

describe('SequenceMemoryScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'reveal-pad'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'tile', '8'))).toBeOnTheScreen(); // 3×3 pad
    expect(screen.queryByTestId(testId(GAME_ID, 'tile', '9'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'countdown'))).toHaveTextContent('3:00');
  });

  it('shows the countdown budget on the default difficulty', async () => {
    await renderScreen({ seed: 'countdown' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'countdown'))).toHaveTextContent('1:30');
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = generateSequence({
      rng: createRng(TUTORIAL_DEMO_SEED),
      sequenceIndex: 0,
      length: 3,
      tileCount: 4,
      prevSequence: null,
    });
    // One tick per advance: chained timers only schedule after each render flush.
    for (let tick = 0; tick < 3; tick += 1) {
      await act(async () => {
        jest.advanceTimersByTime(900);
      });
    }
    for (const tile of demo) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(
      <SequenceMemoryScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />,
    );
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

  it('plays a score-attack session and persists when the budget expires', async () => {
    const seed = 'screen-test-seed';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'reveal-pad'))).toBeOnTheScreen();

    // Round 1 (length 3): pass.
    const seq0 = generateSequence({
      rng: createRng(seed),
      sequenceIndex: 0,
      length: 3,
      tileCount: 4,
      prevSequence: null,
    });
    await revealRound(clock, 3);
    expect(screen.getByTestId(testId(GAME_ID, 'input-pad'))).toBeOnTheScreen();
    for (const tile of seq0) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 100');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));

    // Round 2 (length 4): wrong tap → round fails, score held.
    const seq1 = generateSequence({
      rng: createRng(seed),
      sequenceIndex: 1,
      length: 4,
      tileCount: 4,
      prevSequence: seq0,
    });
    await revealRound(clock, 4);
    const wrongTile = (seq1[0] + 1) % 4;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 100');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));

    // Round 3 (length resets to 3): pass.
    const seq2 = generateSequence({
      rng: createRng(seed),
      sequenceIndex: 2,
      length: 3,
      tileCount: 4,
      prevSequence: seq1,
    });
    await revealRound(clock, 3);
    for (const tile of seq2) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 200');

    // Budget expires mid-session → results with the time-up marker. The clock
    // and timers are walked in lockstep chunks so the countdown ticker detects
    // the expiry exactly at the budget boundary (production behavior: the
    // ticker checks every 250ms, so detection lands at or just past it).
    for (let i = 0; i < 16; i += 1) {
      await advanceTime(clock, 5_000); // 80_000ms of the 90_000ms budget
    }
    await advanceTime(clock, 1_000); // crosses the boundary
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('2/3');
    // The length-4 round was failed, so the longest completed sequence is 3.
    expect(screen.getByTestId(testId(GAME_ID, 'longest-sequence'))).toHaveTextContent('3');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe(GAME_ID);
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(NORMAL_BUDGET_MS); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBeGreaterThan(0);
    expect(input.session.normalizedResult).toBeLessThanOrEqual(1);
    const raw = input.session.rawResult as SequenceMemoryRawResult;
    expect(raw.score).toBe(200);
    expect(raw.timeUp).toBe(true);
    expect(raw.accuracy).toBeCloseTo(2 / 3);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails the round on a wrong tap and the next round restarts at the base length', async () => {
    const seed = 'wrong-tap';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await revealRound(clock, 3);
    expect(screen.getByTestId(testId(GAME_ID, 'input-pad'))).toBeOnTheScreen();

    const sequence = generateSequence({
      rng: createRng(seed),
      sequenceIndex: 0,
      length: 3,
      tileCount: 4,
      prevSequence: null,
    });
    const wrongTile = (sequence[0] + 1) % 4;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-result-pad'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // The next round restarts at the base length after a failure.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    await revealRound(clock, 3); // length still 3
    expect(screen.getByTestId(testId(GAME_ID, 'input-pad'))).toBeOnTheScreen();
  });

  it('expires the session mid-reveal and counts the in-flight round as failed', async () => {
    const { clock, persister } = await renderScreen({ seed: 'time-out' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 900); // one reveal tick
    await advanceTime(clock, NORMAL_BUDGET_MS);

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SequenceMemoryRawResult).timeUp).toBe(true);
  });

  it('pauses: the opaque overlay appears and the budget freezes until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 30_000);
    expect(screen.getByTestId(testId(GAME_ID, 'countdown'))).toHaveTextContent('1:00');

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('memory-sequence-memory.pause-overlay')).toBeOnTheScreen();

    // Frozen: elapsed background time must not drain the budget.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.getByTestId(testId(GAME_ID, 'countdown'))).toHaveTextContent('1:00');

    // Time resumes only after the resume dispatch.
    await advanceTime(clock, 1000);
    expect(screen.getByTestId(testId(GAME_ID, 'countdown'))).toHaveTextContent('0:59');
  });

  it('force-win ends the session with the in-flight round passed and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('1/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as SequenceMemoryRawResult;
    expect(raw.forced).toBe(true);
    expect(raw.timeUp).toBe(false);
    // 1/1 passed at the base length: accuracy 1, no escalation progress.
    expect(input.session.normalizedResult).toBeCloseTo(0.5);
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
    expect((input.session.rawResult as SequenceMemoryRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('force-perfect ends the session with the canonical perfect-run statistics', async () => {
    const { persister } = await renderScreen({ seed: 'qa-perfect' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-perfect')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('975');
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('6/6');
    expect(screen.getByTestId(testId(GAME_ID, 'longest-sequence'))).toHaveTextContent('8');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as SequenceMemoryRawResult;
    expect(raw.forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });
});