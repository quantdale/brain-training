/**
 * TapRushScreen tap-verdict tests (shared feedback language, Drops
 * speed-round model).
 *
 * Proves the playfield verdict is multi-channel and instant: a tap on the
 * target raises a `✓` hit cue while a wrong tap raises a `✕` cue with a
 * distinct label — a miss never reads as a hit. A bottom sheet is
 * deliberately not used here: it would cover the next live target and break
 * the ≤3s speed mechanic.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TAP_RUSH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRoundTargets } from '../generator';
import TapRushScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Field size (px) used by the simulated layout; matches the playfield square. */
const FIELD = 340;
/** Normal difficulty tuning: 10 targets/round, 4 rounds, 1100 ms window. */
const NORMAL = TAP_RUSH_DIFFICULTY_PARAMS.normal;

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

describe('TapRushScreen tap verdict cue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows no verdict before the first tap, a hit cue on target, and a wrong cue that does not read as correct', async () => {
    const seed = 'verdict-cue';
    await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const field = screen.getByTestId(testId(GAME_ID, 'field'));
    await setFieldSize(field);
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    // No resolution yet: the cue slot is present but carries no verdict glyph.
    expect(screen.queryByTestId(testId(GAME_ID, 'verdict'))).toBeNull();

    // A tap on the target raises the hit cue (fill + ✓ + label, instantly).
    const targets = targetsFor(seed, 0);
    await pressAt(field, targets[0].x, targets[0].y);
    const hitCue = screen.getByTestId(testId(GAME_ID, 'verdict'));
    expect(hitCue.props.accessibilityLabel).toBe('Last tap: hit');
    expect(within(hitCue).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(hitCue).queryByText('✕', { includeHiddenElements: true })).toBeNull();

    // A wrong tap raises the miss cue — shape, label, explicitly not a hit.
    const wrong = outsidePoint(targets[1], NORMAL.targetRadius);
    await pressAt(field, wrong.x, wrong.y);
    const wrongCue = screen.getByTestId(testId(GAME_ID, 'verdict'));
    expect(wrongCue.props.accessibilityLabel).toBe('Last tap: wrong');
    expect(wrongCue.props.accessibilityLabel).not.toContain('hit');
    expect(within(wrongCue).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(wrongCue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
  });
});
