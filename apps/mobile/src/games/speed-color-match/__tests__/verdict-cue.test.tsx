/**
 * Speed-color-match trial verdict cue (Campaign 025 shared feedback language).
 *
 * The cue is the speed-round verdict model: soft fill + verdict border +
 * `✓`/`✕`/`⏱` glyph + a visible label, with the verdict in the accessible
 * name (live region). The swatch prompt and the colour board stay mounted
 * while the verdict shows, feedback derives from the reducer's authoritative
 * outcome, and a tap after the stimulus deadline never presents a hit.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { SPEED_COLOR_MATCH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateTrials } from '../generator';
import SpeedColorMatchScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Normal difficulty tuning: 20 trials, 40% incongruent, 4000 ms window. */
const NORMAL = SPEED_COLOR_MATCH_DIFFICULTY_PARAMS.normal;

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
    <SpeedColorMatchScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  return { clock, result };
}

/** The reducer's deterministic trial sequence for a normal session. */
function trialsFor(seed: string) {
  return generateTrials({
    rng: createRng(seed),
    totalTrials: NORMAL.trials,
    incongruentCount: Math.round(NORMAL.trials * NORMAL.incongruentRatio),
  });
}

/** Advance the injected monotonic clock and the pacing timers together. */
async function advance(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

describe('SpeedColorMatchScreen trial verdict cue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a correct pick raises the hit cue and keeps the prompt and board mounted', async () => {
    const seed = 'cue-correct';
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();
    // No resolution yet: no verdict cue is exposed.
    expect(screen.queryByTestId(testId(GAME_ID, 'trial-correct'))).toBeNull();

    await advance(clock, 250);
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'color-btn', trialsFor(seed)[0].swatchColor)),
    );

    const cue = screen.getByTestId(testId(GAME_ID, 'trial-correct'));
    expect(cue.props.accessibilityLabel).toBe('Last trial: hit');
    expect(cue).toHaveTextContent(/Hit/);
    expect(within(cue).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    // The prompt/stem stays mounted while the verdict shows.
    expect(screen.getByTestId(testId(GAME_ID, 'current-swatch'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'trial-status'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'color-grid'))).toBeOnTheScreen();
  });

  it('a wrong pick shows the wrong cue (never the hit cue) with the prompt still mounted', async () => {
    const seed = 'cue-wrong';
    const { clock } = await renderScreen(seed);
    const trial = trialsFor(seed)[0];
    const wrongColor = trial.swatchColor === 'red' ? 'blue' : 'red';

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advance(clock, 200);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color-btn', wrongColor)));

    const cue = screen.getByTestId(testId(GAME_ID, 'trial-wrong'));
    expect(cue.props.accessibilityLabel).toBe('Last trial: wrong');
    expect(cue).toHaveTextContent(/Wrong/);
    expect(within(cue).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cue).queryByText('✓', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'trial-correct'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'current-swatch'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'trial-status'))).toBeOnTheScreen();
  });

  it('a missed trial shows the missed cue, not a hit', async () => {
    const seed = 'cue-timeout';
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advance(clock, NORMAL.stimulusTimeoutMs + 1);

    const cue = screen.getByTestId(testId(GAME_ID, 'trial-wrong'));
    expect(cue.props.accessibilityLabel).toBe('Last trial: missed');
    expect(cue).toHaveTextContent(/Missed/);
    expect(within(cue).getByText('⏱', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'trial-correct'))).toBeNull();
  });

  it('a tap after the deadline presents the resolution outcome, not success', async () => {
    const seed = 'cue-late-tap';
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Pass the stimulus deadline on the injected clock ONLY: the pacing timer
    // has not fired, so the reducer is still in the `trial` phase.
    await act(async () => {
      clock.advance(NORMAL.stimulusTimeoutMs + 500);
    });
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'color-btn', trialsFor(seed)[0].swatchColor)),
    );

    // The overdue tap resolved nothing: no hit cue, no success.
    expect(screen.queryByTestId(testId(GAME_ID, 'trial-correct'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'trial-wrong'))).toBeNull();

    // The timeout owns the resolution and presents the miss.
    await act(async () => {
      jest.advanceTimersByTime(NORMAL.stimulusTimeoutMs);
    });
    const cue = screen.getByTestId(testId(GAME_ID, 'trial-wrong'));
    expect(cue.props.accessibilityLabel).toBe('Last trial: missed');
    expect(screen.queryByTestId(testId(GAME_ID, 'trial-correct'))).toBeNull();
  });

  it('animates the score live and shows the animated final score beside the StatRow', async () => {
    const seed = 'cue-score';
    await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
  });
});
