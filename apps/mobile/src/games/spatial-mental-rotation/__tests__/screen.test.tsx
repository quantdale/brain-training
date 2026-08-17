/**
 * SpatialScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → play → answers → rounds → results →
 * persistence. Timeout handling, pause freeze semantics, and the dev-only QA
 * force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED, buildDemoRound } from '../components/tutorial';
import { SPATIAL_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import type { RotationRound } from '../generator';
import SpatialScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { Block, SpatialRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Expected round content for the reducer's generation (mirrors buildRound). */
function expectedRound(seed: string, roundIndex: number, prevTarget: readonly Block[] | null): RotationRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    params: SPATIAL_DIFFICULTY_PARAMS.normal,
    prevTarget,
  });
}

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
    <SpatialScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the poll timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Press the answer button matching the round's correct kind. */
async function pressCorrectAnswer(kind: RotationRound['kind']) {
  await fireEvent.press(
    screen.getByTestId(testId(GAME_ID, kind === 'same' ? 'same' : 'different')),
  );
}

describe('SpatialScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'timer'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'target', 'shape'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'candidate', 'shape'))).toBeOnTheScreen();
    // expert: 6 blocks per shape
    expect(screen.getByTestId(testId(GAME_ID, 'target', 'block', '5'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'target', 'block', '6'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demoSame = buildDemoRound(TUTORIAL_DEMO_SEED, 'same', 'same');
    const demoDifferent = buildDemoRound(TUTORIAL_DEMO_SEED, 'different', 'different');
    expect(demoSame.kind).toBe('same');
    expect(demoDifferent.kind).toBe('different');

    // Example 1 (SAME): a wrong answer shows the explanation and replays.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-different')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-wrong'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-try-again')));
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-wrong'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-same')));

    // Example 2 (DIFFERENT): same retry loop.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-same')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-wrong'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-try-again')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-different')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(
      <SpatialScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />,
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

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // normal: 5 rounds of 4 blocks; answer each after 1s of active play.
    let prevTarget: readonly Block[] | null = null;
    for (let round = 0; round < 5; round += 1) {
      const expected = expectedRound(seed, round, prevTarget);

      await advanceTime(clock, 1000);
      expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
      expect(screen.getByTestId(testId(GAME_ID, 'candidate', 'block', '3'))).toBeOnTheScreen();
      expect(screen.queryByTestId(testId(GAME_ID, 'candidate', 'block', '4'))).toBeNull();

      await pressCorrectAnswer(expected.kind);
      expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();

      if (round < 4) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
      prevTarget = expected.target;
    }

    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('5/5');
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('735'); // 5 × 147

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('spatial-mental-rotation');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(5 * 1000); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBeGreaterThan(0);
    expect(input.session.normalizedResult).toBeLessThanOrEqual(1);
    const raw = input.session.rawResult as SpatialRawResult;
    expect(raw.score).toBe(735);
    expect(raw.accuracy).toBe(1);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails the round on a wrong answer and continues', async () => {
    const seed = 'wrong-tap';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const expected = expectedRound(seed, 0, null);
    await advanceTime(clock, 1000);
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();

    const wrong = expected.kind === 'same' ? 'different' : 'same';
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, wrong)));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // The next round continues with the same fixed-level params.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
  });

  it('times out when the budget expires and reveals the correct answer', async () => {
    const { clock } = await renderScreen({ seed: 'timeout-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 16_000);

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    const expected = expectedRound('timeout-test', 0, null);
    expect(
      screen.getByText(expected.kind === 'same' ? /“Same”/ : /“Different”/),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and the budget freezes until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 1000); // 1s of budget consumed

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('spatial-mental-rotation.pause-overlay')).toBeOnTheScreen();

    // Frozen: background time must not consume the budget.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();

    // Only the remaining 15s of active time can expire the round.
    await advanceTime(clock, 14_900);
    expect(screen.getByTestId(testId(GAME_ID, 'play-status'))).toBeOnTheScreen();
    await advanceTime(clock, 100);
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
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
    expect((input.session.rawResult as SpatialRawResult).forced).toBe(true);
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
    expect((input.session.rawResult as SpatialRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('force-timeout ends the session with the round timed out', async () => {
    const { persister } = await renderScreen({ seed: 'qa-timeout' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-timeout')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'timeouts'))).toHaveTextContent('1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SpatialRawResult).timeouts).toBe(1);
  });
});
