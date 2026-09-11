/**
 * Verdict-cue contract (PATTERNS-PLAY 6) for Next in Sequence.
 *
 * After a wrong pick the tapped option must show the wrong cue (✕ glyph +
 * "Wrong pick" accessible name) AND the true continuation must show the
 * correct cue (✓ glyph + "Correct" accessible name) at the same time; the
 * wrong option must never expose the correct cue or name.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { LOGIC_DIFFICULTY_PARAMS } from '../difficulty';
import { generatePuzzle } from '../generator';
import LogicScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { LogicPuzzle } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

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

async function renderScreen(options: { seed?: string } = {}) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  const result = await render(
    <LogicScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'verdict-cue'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance the fake lifecycle clock (no timers exist in this game). */
async function advanceTime(clock: { advance: (ms: number) => void }, ms: number) {
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

describe('LogicScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a wrong pick marks the wrong option AND the correct option together', async () => {
    const seed = 'verdict-cue';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const first = normalPuzzle(seed, 0, null);
    await advanceTime(clock, 4000);
    const wrongIndex = (first.answerIndex + 1) % first.options.length;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();

    const wrongOption = screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex)));
    const correctOption = screen.getByTestId(
      testId(GAME_ID, 'option', String(first.answerIndex)),
    );

    // Wrong cue on the tapped option …
    expect(within(wrongOption).getByText('✕')).toBeOnTheScreen();
    expect(wrongOption.props.accessibilityLabel).toMatch(/Wrong pick/);
    // … correct cue alongside it on the true continuation …
    expect(within(correctOption).getByText('✓')).toBeOnTheScreen();
    expect(correctOption.props.accessibilityLabel).toMatch(/Correct/);
    // … and the wrong option never reads as correct.
    expect(within(wrongOption).queryByText('✓')).toBeNull();
    expect(wrongOption.props.accessibilityLabel).not.toMatch(/Correct/);
    // Untouched options read as locked, not as verdicts.
    for (let index = 0; index < first.options.length; index += 1) {
      if (index === wrongIndex || index === first.answerIndex) continue;
      const dimmed = screen.getByTestId(testId(GAME_ID, 'option', String(index)));
      expect(dimmed.props.accessibilityLabel).toMatch(/locked/);
      expect(within(dimmed).queryByText('✓')).toBeNull();
      expect(within(dimmed).queryByText('✕')).toBeNull();
    }
  });

  it('keeps the one-line pattern explanation next to the revealed answer', async () => {
    const seed = 'verdict-why';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const first = normalPuzzle(seed, 0, null);
    await advanceTime(clock, 4000);
    const wrongIndex = (first.answerIndex + 1) % first.options.length;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));

    // The pattern hint pairs the revealed term with its 1-line why while the
    // answered board (options + sequence) stays reviewable behind it.
    expect(screen.getByTestId(testId(GAME_ID, 'pattern-hint'))).toHaveTextContent(
      new RegExp(`The next term is ${first.answer} — `),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'result-sequence'))).toBeOnTheScreen();
  });
});
