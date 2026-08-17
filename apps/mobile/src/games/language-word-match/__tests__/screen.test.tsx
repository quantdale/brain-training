/**
 * LanguageWordMatchScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → question → rounds → results → persistence.
 * Pause freeze semantics, the round-expiry timeout path, and the dev-only QA
 * force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { loadContentPack } from '../content-validation';
import { filterByTiers, selectRound } from '../generator';
import type { LanguageRound } from '../types';
import LanguageWordMatchScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { LanguageRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL_POOL = filterByTiers(loadContentPack().items, ['t1', 't2']);
const T1_POOL = filterByTiers(loadContentPack().items, ['t1']);

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
    <LanguageWordMatchScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the round timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Deterministic mirror of the reducer's round generation for a fixed pool. */
function expectedRound(
  seed: string,
  roundIndex: number,
  used: ReadonlySet<string>,
  previous: LanguageRound | null,
): LanguageRound {
  return selectRound({
    rng: createRng(seed),
    roundIndex,
    pool: NORMAL_POOL,
    usedItemIds: used,
    previousRound: previous,
  });
}

describe('LanguageWordMatchScreen', () => {
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
    expect(screen.getByTestId(testId(GAME_ID, 'prompt'))).toBeOnTheScreen();
    for (let index = 0; index < 4; index += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'option', String(index)))).toBeOnTheScreen();
    }
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = selectRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      pool: T1_POOL,
      usedItemIds: new Set(),
      previousRound: null,
    });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-prompt'))).toHaveTextContent(demo.prompt);
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(demo.correctIndex))),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(
      <LanguageWordMatchScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // The help button requests a replay.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('walks the tutorial wrong-answer path: reveal, retry with a fresh demo', async () => {
    await renderScreen({ seed: 'tut-wrong', store: createInMemoryTutorialStore() });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = selectRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      pool: T1_POOL,
      usedItemIds: new Set(),
      previousRound: null,
    });
    const wrongIndex = (demo.correctIndex + 1) % 4;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-retry'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(
      /Not quite/,
    );

    // Retry draws a fresh deterministic demo (roundIndex 1).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-retry')));
    const retry = selectRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 1,
      pool: T1_POOL,
      usedItemIds: new Set(),
      previousRound: null,
    });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-prompt'))).toHaveTextContent(retry.prompt);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(retry.correctIndex))));
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
    expect(screen.getByTestId(testId(GAME_ID, 'prompt'))).toBeOnTheScreen();

    // normal: 6 rounds, 8000ms budget; answer 500ms into each round.
    let previous: LanguageRound | null = null;
    const used = new Set<string>();
    for (let round = 0; round < 6; round += 1) {
      const expected = expectedRound(seed, round, used, previous);
      used.add(expected.itemId);
      previous = expected;

      await advanceTime(clock, 500);
      expect(screen.getByTestId(testId(GAME_ID, 'prompt'))).toHaveTextContent(expected.prompt);
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'option', String(expected.correctIndex))),
      );

      if (round < 5) {
        expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }

    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-correct'))).toHaveTextContent('6/6');
    expect(screen.getByTestId(testId(GAME_ID, 'avg-time'))).toHaveTextContent('0.5s');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('language-word-match');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.generatorVersion).toBe(0); // non-procedural
    expect(input.session.durationMs).toBe(6 * 500); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBeCloseTo(0.96875); // 1 * (0.5 + 0.5 * (1 - 0.375/6))
    const raw = input.session.rawResult as LanguageRawResult;
    expect(raw.score).toBe(882); // 6 × roundScore(500, 8000)
    expect(raw.roundsCorrect).toBe(6);
    expect(raw.contentPackId).toBe('language-word-match-core-v1');
    expect(raw.contentPackVersion).toBe('2.0.0');
    expect(raw.roundOutcomes).toEqual(['correct', 'correct', 'correct', 'correct', 'correct', 'correct']);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails the round on a wrong option, reveals the answer, and continues', async () => {
    const seed = 'wrong-tap';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const round1 = expectedRound(seed, 0, new Set(), null);
    await advanceTime(clock, 1000);
    const wrongIndex = (round1.correctIndex + 1) % 4;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-answer-reveal'))).toHaveTextContent(
      `The answer was ${round1.correctWord}`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // The next round keeps the fixed tuning.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'time-budget'))).toHaveTextContent('Answer within 8s');
  });

  it('times out a round at the budget deadline and reveals the answer', async () => {
    const { clock } = await renderScreen({ seed: 'timeout' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // easy budget is 10s; nothing fires before the deadline.
    await advanceTime(clock, 9999);
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();

    await advanceTime(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-answer-reveal'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');
  });

  it('pauses: the opaque overlay appears and the deadline freezes until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 1000); // 1000 of 8000ms used

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('language-word-match.pause-overlay')).toBeOnTheScreen();

    // Frozen: background time must not advance the round.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();

    // The full remaining 7000ms is still required: 6999 → not expired.
    await advanceTime(clock, 6999);
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
    expect((input.session.rawResult as LanguageRawResult).forced).toBe(true);
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
    expect((input.session.rawResult as LanguageRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('force-timeout expires only the current round and keeps playing', async () => {
    const seed = 'qa-timeout';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-timeout')));

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'results'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();

    // Finish the session; it must NOT be marked forced.
    const round0 = expectedRound(seed, 0, new Set(), null);
    let previous: LanguageRound = round0;
    const used = new Set<string>([round0.itemId]);
    for (let round = 1; round < 6; round += 1) {
      const expected = expectedRound(seed, round, used, previous);
      used.add(expected.itemId);
      previous = expected;
      await advanceTime(clock, 500);
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'option', String(expected.correctIndex))),
      );
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'forced-badge'))).toBeNull();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as LanguageRawResult;
    expect(raw.forced).toBe(false);
    expect(raw.roundOutcomes).toEqual(['timeout', 'correct', 'correct', 'correct', 'correct', 'correct']);
  });
});
