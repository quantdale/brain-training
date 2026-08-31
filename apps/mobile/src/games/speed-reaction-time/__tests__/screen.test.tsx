/**
 * SpeedScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → wait → GO → tap → rounds → results →
 * persistence. Timing correctness (RT measured against the monotonic clock at
 * the GO display moment), pause freeze semantics, the reaction-window
 * timeout, and the dev-only QA force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_DELAY_MS } from '../components/tutorial';
import { generateRoundDelay, isNoGoRound } from '../generator';
import SpeedScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { SpeedRawResult } from '../types';
import { WITHHELD_ROUND_SCORE } from '../scoring';
import { SPEED_DIFFICULTY_PARAMS } from '../difficulty';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = SPEED_DIFFICULTY_PARAMS.normal;

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
    <SpeedScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the pending timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Advance only the fake lifecycle clock (reaction time passes; no timers fire). */
async function advanceClock(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
  });
}

/** Expected seeded wait for a normal-difficulty round. */
function delayFor(seed: string, roundIndex: number): number {
  return generateRoundDelay({
    rng: createRng(seed),
    roundIndex,
    minDelayMs: NORMAL.minDelayMs,
    maxDelayMs: NORMAL.maxDelayMs,
  });
}

/** Whether the normal-difficulty round `roundIndex` of `seed` is a NO-GO. */
function isNoGoTrial(seed: string, roundIndex: number): boolean {
  return isNoGoRound({
    rng: createRng(seed),
    roundIndex,
    noGoProbability: NORMAL.noGoProbability,
  });
}

/** First `prefix-N` seed whose early normal rounds are all plain-GO. */
function findPlainGoSeed(prefix: string, rounds = 3): string {
  outer: for (let i = 0; i < 100_000; i += 1) {
    const candidate = `${prefix}-${i}`;
    for (let round = 0; round < rounds; round += 1) {
      if (isNoGoTrial(candidate, round)) {
        continue outer;
      }
    }
    return candidate;
  }
  throw new Error(`findPlainGoSeed: exhausted seed space for ${prefix}`);
}

/** First `prefix-N` seed whose round 0 is a NO-GO trial. */
function findNoGoSeed(prefix: string): string {
  for (let i = 0; i < 100_000; i += 1) {
    const candidate = `${prefix}-${i}`;
    if (isNoGoTrial(candidate, 0)) {
      return candidate;
    }
  }
  throw new Error(`findNoGoSeed: exhausted seed space for ${prefix}`);
}

/** Wait out the current round's GO delay and assert the signal is displayed. */
async function reachGo(clock: ReturnType<typeof createFakeClock>, seed: string, roundIndex: number) {
  await advanceTime(clock, delayFor(seed, roundIndex));
  expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
}

/** React after `rtMs` of clock-only time and assert the round passed. */
async function reactFast(clock: ReturnType<typeof createFakeClock>, rtMs: number) {
  await advanceClock(clock, rtMs);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
  expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
}

describe('SpeedScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'wait-status'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'trigger'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { clock, result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      /Watch the button/,
    );

    await advanceTime(clock, TUTORIAL_DEMO_DELAY_MS);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      /Tap the button now/,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-trigger')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(
      <SpeedScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // The help button requests a replay.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('restarts the demo after a false start in the tutorial', async () => {
    const { clock } = await renderScreen({ seed: 'tut-fs', store: createInMemoryTutorialStore() });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    // Tapping before the demo GO resets the demo (attempt remount).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-trigger')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      /Watch the button/,
    );

    await advanceTime(clock, TUTORIAL_DEMO_DELAY_MS + 1);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      /Tap the button now/,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-trigger')));
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

    let expectedActiveMs = 0;
    let expectedScore = 0;
    let goTrials = 0;
    let withholds = 0;
    for (let round = 0; round < NORMAL.rounds; round += 1) {
      const delay = delayFor(seed, round);
      expectedActiveMs += delay;
      await advanceTime(clock, delay);
      if (isNoGoTrial(seed, round)) {
        // ✕ stimulus: HOLD — survive the withhold window.
        expect(screen.getByTestId(testId(GAME_ID, 'hold-status'))).toBeOnTheScreen();
        expectedActiveMs += NORMAL.timeoutMs;
        await advanceTime(clock, NORMAL.timeoutMs);
        expect(screen.getByTestId(testId(GAME_ID, 'round-withheld'))).toBeOnTheScreen();
        expectedScore += WITHHELD_ROUND_SCORE;
        withholds += 1;
      } else {
        expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
        await advanceClock(clock, 400); // measured reaction: exactly 400 ms
        expectedActiveMs += 400;
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
        expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
        expect(screen.getByTestId(testId(GAME_ID, 'reaction-ms'))).toHaveTextContent(
          /Reaction 400 ms/,
        );
        expectedScore += 150;
        goTrials += 1;
      }
      if (round < NORMAL.rounds - 1) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }

    // Final round: the result card's button leads to the results screen.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent(
      `${NORMAL.rounds}/${NORMAL.rounds}`,
    );
    if (goTrials > 0) {
      expect(screen.getByTestId(testId(GAME_ID, 'median-reaction'))).toHaveTextContent('400 ms');
    }
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(String(expectedScore));
    if (withholds > 0) {
      expect(screen.getByTestId(testId(GAME_ID, 'no-go-held'))).toHaveTextContent(
        `${withholds}/${withholds}`,
      );
    }

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('speed-reaction-time');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(expectedActiveMs); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as SpeedRawResult;
    expect(raw.medianReactionMs).toBe(goTrials > 0 ? 400 : null);
    expect(raw.bestReactionMs).toBe(goTrials > 0 ? 400 : null);
    expect(raw.reactions).toHaveLength(goTrials);
    expect(raw.noGoWithheld).toBe(withholds);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.1.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('marks a slow reaction as a failed round and continues', async () => {
    const seed = findPlainGoSeed('slow-tap');
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await reachGo(clock, seed, 0);
    await advanceClock(clock, 700); // above passMs (600) → failed round
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'reaction-ms'))).toHaveTextContent(
      /Reaction 700 ms/,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('ends the session early when the false-start budget is exceeded', async () => {
    const seed = 'false-start';
    const { persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // First false start: within budget → round result, session continues.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
    expect(screen.getByTestId(testId(GAME_ID, 'round-false-start'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'false-starts-left'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();

    // Second false start: budget (1) exceeded → session aborts to results.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'aborted-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'false-starts'))).toHaveTextContent('2');
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/2');

    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as SpeedRawResult;
    expect(raw.falseStartAborted).toBe(true);
    expect(raw.falseStarts).toBe(2);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('times out the round when no tap arrives in time', async () => {
    const seed = findPlainGoSeed('timeout', 1);
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await reachGo(clock, seed, 0);
    await advanceTime(clock, NORMAL.timeoutMs); // no tap within the window

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('withholds correctly on a NO-GO stimulus (✕ HOLD) without tapping', async () => {
    const seed = findNoGoSeed('hold-win');
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, delayFor(seed, 0));

    // The danger cue is shown instead of GO.
    expect(screen.getByTestId(testId(GAME_ID, 'hold-status'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'go-status'))).toBeNull();

    // Surviving the withhold window resolves the round as a correct withhold.
    await advanceTime(clock, NORMAL.timeoutMs);
    expect(screen.getByTestId(testId(GAME_ID, 'round-withheld'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(
      `Score ${WITHHELD_ROUND_SCORE}`,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('penalizes tapping a NO-GO stimulus like a false start', async () => {
    const seed = findNoGoSeed('hold-fail');
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, delayFor(seed, 0));
    expect(screen.getByTestId(testId(GAME_ID, 'hold-status'))).toBeOnTheScreen();

    // Tapping the ✕ costs a false start (normal budget 1 → within budget here).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'trigger')));
    expect(screen.getByTestId(testId(GAME_ID, 'round-no-go-false-start'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(0); // still running
  });

  it('pauses during the wait: the overlay appears, timers freeze, and the remaining delay resumes', async () => {
    const seed = findPlainGoSeed('pause-wait');
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 500); // partway through the wait

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('speed-reaction-time.pause-overlay')).toBeOnTheScreen();

    // Frozen: background time must not fire the GO timer.
    await advanceTime(clock, 5000);
    expect(screen.queryByTestId(testId(GAME_ID, 'go-status'))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    const remainingDelay = Math.max(0, delayFor(seed, 0) - 500);
    if (remainingDelay > 0) {
      expect(screen.queryByTestId(testId(GAME_ID, 'go-status'))).toBeNull();
      await advanceTime(clock, remainingDelay - 1);
      expect(screen.queryByTestId(testId(GAME_ID, 'go-status'))).toBeNull();
      await advanceTime(clock, 1);
    } else {
      await advanceTime(clock, 0);
    }
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
  });

  it('pauses during the GO phase: the remaining reaction window resumes', async () => {
    const seed = findPlainGoSeed('pause-go', 1);
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await reachGo(clock, seed, 0);
    const elapsedBeforePause = 200;
    await advanceClock(clock, elapsedBeforePause);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('speed-reaction-time.pause-overlay')).toBeOnTheScreen();

    // Frozen: the timeout timer must not fire while paused.
    await advanceTime(clock, 5000);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.getByTestId(testId(GAME_ID, 'go-status'))).toBeOnTheScreen();
    const remainingWindow = NORMAL.timeoutMs - elapsedBeforePause;
    await advanceTime(clock, remainingWindow - 1);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
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
    expect((input.session.rawResult as SpeedRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a false-start storm', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'aborted-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/10');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SpeedRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('force-timeout fails the current round and the session continues', async () => {
    const seed = findPlainGoSeed('qa-to', 2);
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-timeout')));

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();

    // Round 2 is a normal round (the force hook did not end the session):
    // reach the GO and react; persistence must not have run yet.
    await reachGo(clock, seed, 1);
    await reactFast(clock, 400);
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(0); // still in session
  });
});
