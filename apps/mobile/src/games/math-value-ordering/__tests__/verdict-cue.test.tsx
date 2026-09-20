/**
 * Verdict-cue contract (PATTERNS-PLAY 6) for Value Order.
 *
 * The resolved frame must keep the submitted sequence visible next to the
 * correct one: the board stays mounted read-only with per-tile verdicts
 * (✓ + "Correct pick" on correct taps with their rank badges, ✕ + "Wrong
 * pick" on the mistake tile, dimmed rest) while the panel lists the correct
 * order (`reveal`) beside the submitted order (`submitted-order`). Scores
 * animate through `AnimatedNumber`.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { VALUE_ORDERING_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import ValueOrderingScreen, { sortedTilesOf } from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = VALUE_ORDERING_DIFFICULTY_PARAMS.normal;
const BUDGET_MS = NORMAL.budgetMs;

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
  return { completeSession } as unknown as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(options: { seed?: string } = {}) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  const result = await render(
    <ValueOrderingScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'verdict-cue'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the budget ticker (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Deterministic round 0 for a normal session. */
function roundZero(seed: string) {
  return generateRound(createRng(seed), 0, NORMAL, NORMAL.tiles, null);
}

describe('ValueOrderingScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a mistake keeps the submitted order on the board next to the correct order', async () => {
    const seed = 'verdict-mistake';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const round = roundZero(seed);
    const sorted = sortedTilesOf(round);
    // Tap the smallest (correct, locks with rank 1), then a wrong tile.
    await advanceTime(clock, 1000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(sorted[0].value))));
    const wrong = sorted[2];
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrong.value))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-mistake'))).toBeOnTheScreen();

    // Board stays mounted: submitted order readable via ranks + verdicts.
    expect(screen.getByTestId(testId(GAME_ID, 'value-grid'))).toBeOnTheScreen();
    const correctTile = screen.getByTestId(testId(GAME_ID, 'tile', String(sorted[0].value)));
    expect(correctTile.props.accessibilityLabel).toMatch(/Correct pick/);
    expect(correctTile.props.accessibilityLabel).toMatch(/position 1/);
    expect(
      within(correctTile).getByText('✓', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'tile-rank', '1'))).toBeOnTheScreen();

    const wrongTile = screen.getByTestId(testId(GAME_ID, 'tile', String(wrong.value)));
    expect(wrongTile.props.accessibilityLabel).toMatch(/Wrong pick/);
    expect(wrongTile.props.accessibilityLabel).not.toMatch(/Correct/);
    expect(within(wrongTile).getByText('✕', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(wrongTile).queryByText('✓', { includeHiddenElements: true })).toBeNull();

    // Correct sequence and submitted sequence listed side by side.
    const correctOrder = sorted.map((tile) => tile.display).join('  <  ');
    expect(screen.getByTestId(testId(GAME_ID, 'reveal'))).toHaveTextContent(
      `Correct order: ${correctOrder}`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'submitted-order'))).toHaveTextContent(
      `Your order: ${sorted[0].display}  <  ${wrong.display}`,
    );
    // The prompt stays mounted while feedback shows.
    expect(screen.getByTestId(testId(GAME_ID, 'prompt'))).toHaveTextContent(
      'Tap from smallest to largest',
    );
  });

  it('a perfect round marks every tile correct and both orders agree', async () => {
    const seed = 'verdict-perfect';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const round = roundZero(seed);
    const sorted = sortedTilesOf(round);
    await advanceTime(clock, 1000);
    for (const tile of sorted) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile.value))));
    }

    expect(screen.getByTestId(testId(GAME_ID, 'round-perfect'))).toBeOnTheScreen();
    for (const tile of sorted) {
      const el = screen.getByTestId(testId(GAME_ID, 'tile', String(tile.value)));
      expect(el.props.accessibilityLabel).toMatch(/Correct pick/);
      expect(within(el).getByText('✓', { includeHiddenElements: true })).toBeOnTheScreen();
    }
    const grid = screen.getByTestId(testId(GAME_ID, 'value-grid'));
    expect(within(grid).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    const correctOrder = sorted.map((tile) => tile.display).join('  <  ');
    expect(screen.getByTestId(testId(GAME_ID, 'submitted-order'))).toHaveTextContent(
      `Your order: ${correctOrder}`,
    );
  });

  it('a timeout keeps the board and the correct order with an empty submitted order', async () => {
    const seed = 'verdict-timeout';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const round = roundZero(seed);
    await advanceTime(clock, BUDGET_MS + 1000);

    expect(screen.getByTestId(testId(GAME_ID, 'round-timeout'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'value-grid'))).toBeOnTheScreen();
    const correctOrder = sortedTilesOf(round)
      .map((tile) => tile.display)
      .join('  <  ');
    expect(screen.getByTestId(testId(GAME_ID, 'reveal'))).toHaveTextContent(
      `Correct order: ${correctOrder}`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'submitted-order'))).toHaveTextContent(
      'Your order: no tiles placed yet.',
    );
    const grid = screen.getByTestId(testId(GAME_ID, 'value-grid'));
    expect(within(grid).queryByText('✕', { includeHiddenElements: true })).toBeNull();
    expect(within(grid).queryByText('✓', { includeHiddenElements: true })).toBeNull();
  });

  it('animates the score live in session and in results', async () => {
    await renderScreen({ seed: 'verdict-score' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score-final'))).toBeOnTheScreen();
  });
});
