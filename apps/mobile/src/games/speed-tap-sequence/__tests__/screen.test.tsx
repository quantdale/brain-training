/**
 * TapRushScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → active (per-target hit/expiry) → rounds →
 * results → persistence. Pause freeze semantics (window and reaction time
 * exclude paused time) and the dev-only QA force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { TAP_RUSH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRoundTargets } from '../generator';
import TapRushScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { TapRushRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Field size (px) used by the simulated layout; matches the playfield square. */
const FIELD = 340;
/** Normal difficulty tuning: 10 targets/round, 4 rounds, 1100 ms window. */
const NORMAL = TAP_RUSH_DIFFICULTY_PARAMS.normal;
const WINDOW_MS = NORMAL.initialWindowMs;

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
    <TapRushScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the window-expiry timers. */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Report a layout so the field maps taps to normalized coordinates. */
async function setFieldSize(field: ReturnType<typeof screen.getByTestId>) {
  await fireEvent(field, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: FIELD, height: FIELD } },
  });
}

/**
 * A point exactly `2 * radius` horizontally away from a target — always
 * inside the field when the target is (flip direction at the edge), always
 * outside the target's circle.
 */
function outsidePoint(target: { x: number; y: number }, radius: number) {
  const dx = target.x + 2 * radius <= 1 ? 2 * radius : -2 * radius;
  return { x: target.x + dx, y: target.y };
}

/** Press the field at normalized coordinates. */
async function pressAt(field: ReturnType<typeof screen.getByTestId>, x: number, y: number) {
  await fireEvent.press(field, {
    nativeEvent: { locationX: x * FIELD, locationY: y * FIELD },
  });
}

/** Deterministic placement for the normal difficulty, mirroring the reducer. */
function targetsFor(seed: string, roundIndex: number) {
  return generateRoundTargets({
    rng: createRng(seed),
    roundIndex,
    count: NORMAL.count,
    radius: NORMAL.targetRadius,
  });
}

describe('TapRushScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'field'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    // Expert: 14 targets per round; the first live target is rendered.
    expect(screen.getByTestId(testId(GAME_ID, 'target', '0'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = generateRoundTargets({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      count: 3,
      radius: 0.09,
    });
    const demoField = screen.getByTestId(testId(GAME_ID, 'tutorial-field'));
    await setFieldSize(demoField);
    for (const target of demo) {
      await pressAt(demoField, target.x, target.y);
    }
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(<TapRushScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
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
    const field = screen.getByTestId(testId(GAME_ID, 'field'));
    await setFieldSize(field);

    for (let round = 0; round < NORMAL.rounds; round += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'round', String(round + 1)))).toBeOnTheScreen();
      // The Playfield unmounts during roundResult and remounts in the next
      // active phase with width=0. Re-report the layout so taps normalize.
      const liveField = screen.getByTestId(testId(GAME_ID, 'field'));
      await setFieldSize(liveField);
      for (const target of targetsFor(seed, round)) {
        await pressAt(liveField, target.x, target.y);
      }
      expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
      if (round < NORMAL.rounds - 1) {
        // Advance the clock between rounds only (no expiry timers pending in
        // the round-result phase) so the session takes measurable active time.
        await advanceTime(clock, 700);
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'targets-hit'))).toHaveTextContent('40/40');
    expect(screen.getByTestId(testId(GAME_ID, 'perfect-rounds'))).toHaveTextContent('4/4');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('speed-tap-rush');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(2100); // 3 inter-round advances, active time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBe(1); // all hits at reaction 0
    const raw = input.session.rawResult as TapRushRawResult;
    expect(raw.score).toBe(8000); // 40 targets × 200
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails the round on a wrong tap and continues', async () => {
    const seed = 'wrong-tap';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const field = screen.getByTestId(testId(GAME_ID, 'field'));
    await setFieldSize(field);

    // A wrong tap loses the target but the round continues (target 1).
    const first = targetsFor(seed, 0)[0];
    const wrong = outsidePoint(first, NORMAL.targetRadius);
    await pressAt(field, wrong.x, wrong.y);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // Hitting the remaining targets ends the round as failed.
    const targets = targetsFor(seed, 0);
    for (let i = 1; i < targets.length; i += 1) {
      await pressAt(field, targets[i].x, targets[i].y);
    }
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    // 9 targets hit instantly at windowMs=1100 → 9 × 150 = 1350 (no perfect-round bonus)
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 1350');

    // The next round holds the window (failures do not shrink it).
    await advanceTime(clock, 100);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'target', '0'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and the window freezes until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const field = screen.getByTestId(testId(GAME_ID, 'field'));
    await setFieldSize(field);

    await advanceTime(clock, 300); // part of the 1100 ms window elapses
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('speed-tap-rush.pause-overlay')).toBeOnTheScreen();

    // A long pause must not expire the target: 800 ms of window remain.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId('speed-tap-rush.pause-overlay')).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'target', '0'))).toBeOnTheScreen();

    // The exact remaining window is required before the expiry fires.
    await advanceTime(clock, 799);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '0'))).toBeOnTheScreen();
    await advanceTime(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'target', '1'))).toBeOnTheScreen();
    // The round is still active (a miss only advances the target).
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();
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
    expect((input.session.rawResult as TapRushRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session with the round unresolved targets missed', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'targets-hit'))).toHaveTextContent('0/10');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as TapRushRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});