/**
 * Speed-order-sweep verdict cue (Campaign 025 shared feedback language).
 *
 * The cue is the speed-round verdict model: soft fill + verdict border +
 * `✓`/`✕`/`⏱` glyph + a visible label, with the verdict in the accessible
 * name (live region). In-play verdicts come from the reducer's `lastVerdict`;
 * the round verdict comes from `roundOutcome`, so a tap after the window
 * closes can never present a hit. The prompt and the board stay mounted while
 * the round verdict shows.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { ORDER_SWEEP_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import OrderSweepScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Normal difficulty tuning: 5 rounds, 9 tokens, 8000 ms window. */
const NORMAL = ORDER_SWEEP_DIFFICULTY_PARAMS.normal;

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
  const result = await render(
    <OrderSweepScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  return { clock, result };
}

/** The reducer's deterministic first round for a normal session. */
function firstRound(seed: string) {
  return generateRound({
    rng: createRng(seed),
    roundIndex: 0,
    count: NORMAL.count,
    columns: NORMAL.columns,
    maxValue: NORMAL.maxValue,
  });
}

/** Advance the injected monotonic clock and the pacing timers together. */
async function advance(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

describe('OrderSweepScreen verdict cue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a correct tap raises the hit cue while the prompt and board stay mounted', async () => {
    const seed = 'sweep-cue-correct';
    const { clock } = await renderScreen(seed);
    const round = firstRound(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();
    // No tap yet: the cue slot is present but carries no verdict.
    expect(screen.queryByTestId(testId(GAME_ID, 'verdict'))).toBeNull();

    await advance(clock, 500);
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'token', String(round.order[0]))),
    );

    const cue = screen.getByTestId(testId(GAME_ID, 'verdict'));
    expect(cue.props.accessibilityLabel).toBe('Last tap: hit');
    expect(cue).toHaveTextContent(/Hit/);
    expect(within(cue).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    // The prompt/stem stays mounted while the verdict shows.
    expect(screen.getByTestId(testId(GAME_ID, 'active-status'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'grid'))).toBeOnTheScreen();
  });

  it('a wrong tap shows the wrong cue and the round continues', async () => {
    const seed = 'sweep-cue-wrong';
    const { clock } = await renderScreen(seed);
    const round = firstRound(seed);
    const wrongValue = Math.max(...round.tokens.map((token) => token.value));

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advance(clock, 500);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'token', String(wrongValue))));

    const cue = screen.getByTestId(testId(GAME_ID, 'verdict'));
    expect(cue.props.accessibilityLabel).toBe('Last tap: wrong');
    expect(cue).toHaveTextContent(/Wrong/);
    expect(within(cue).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    // The round is still live — no result card, no forced success.
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'grid'))).toBeOnTheScreen();
  });

  it('a missed round shows the missed cue with the board still mounted', async () => {
    const seed = 'sweep-cue-expired';
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advance(clock, NORMAL.initialWindowMs + 1);

    const cue = screen.getByTestId(testId(GAME_ID, 'verdict'));
    expect(cue.props.accessibilityLabel).toBe('Last round: missed');
    expect(cue).toHaveTextContent(/Missed/);
    expect(within(cue).getByText('⏱', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    // The prompt and board remain readable behind the round verdict.
    expect(screen.getByTestId(testId(GAME_ID, 'active-status'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'grid'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
  });

  it('a tap after the deadline presents the resolution outcome, not success', async () => {
    const seed = 'sweep-cue-late-tap';
    const { clock } = await renderScreen(seed);
    const round = firstRound(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Pass the window deadline on the injected clock ONLY: the expiry timer
    // has not fired, so the reducer is still in the `active` phase.
    await act(async () => {
      clock.advance(NORMAL.initialWindowMs + 500);
    });
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'token', String(round.order[0]))),
    );

    // The overdue tap resolved nothing: no hit cue, no success.
    expect(screen.queryByTestId(testId(GAME_ID, 'verdict'))).toBeNull();

    // The expiry owns the resolution and presents the miss.
    await act(async () => {
      jest.advanceTimersByTime(NORMAL.initialWindowMs);
    });
    const cue = screen.getByTestId(testId(GAME_ID, 'verdict'));
    expect(cue.props.accessibilityLabel).toBe('Last round: missed');
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
  });

  it('animates the score live and shows the animated final score beside the StatRow', async () => {
    const seed = 'sweep-cue-score';
    await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
  });
});
