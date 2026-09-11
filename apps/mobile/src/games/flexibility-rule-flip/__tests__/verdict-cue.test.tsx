/**
 * Rule-flip verdict-cue tests (PATTERNS-PLAY 6–7, FEEDBACK-CHOREOGRAPHY).
 *
 * A wrong pick must mark the picked card wrong (danger fill + ✕ + "Wrong
 * pick" label) AND the correct card correct (success fill + ✓ + "Correct"
 * label) together, while the rule prompt stays visible through feedback —
 * including uncued windows, where the round is already scored and the rule
 * is no longer hidden.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS } from '../difficulty';
import { generateSession } from '../generator';
import RuleFlipScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID, RULE_LABELS } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const ARM_MS = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal.switchArmMs;

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
  const store = completedStore();
  const persister = makePersister();
  await render(
    <RuleFlipScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={seed}
      persistSession={persister}
    />,
  );
  return { clock, store, persister };
}

async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

async function startNormalSession(seed: string) {
  const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal;
  const plan = generateSession(seed, params);
  const { clock } = await renderScreen(seed);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return { clock, plan };
}

/** Press a card, letting the post-flip arm window elapse first when armed. */
async function pressCard(
  clock: ReturnType<typeof createFakeClock>,
  isSwitch: boolean,
  index: number,
) {
  if (isSwitch) {
    await advanceTime(clock, ARM_MS);
  }
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(index))));
}

const gridCard = (grid: string, index: number) => testId(GAME_ID, grid, 'card', String(index));
const verdictBadge = (grid: string, index: number) =>
  screen.getByTestId(`${gridCard(grid, index)}.verdict`, { includeHiddenElements: true });

describe('RuleFlipScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the wrong pick AND the correct card together, keeping the rule visible', async () => {
    const { clock, plan } = await startNormalSession('verdict-wrong');
    const wrongIndex = (plan[0].correctIndex + 1) % plan[0].candidates.length;

    // The live score readout is visible during play.
    expect(screen.getByTestId(testId(GAME_ID, 'score-live'))).toBeOnTheScreen();

    await pressCard(clock, plan[0].isSwitch, wrongIndex);

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    // Rule prompt stays visible during feedback.
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[plan[0].rule],
    );

    const wrongCard = screen.getByTestId(gridCard('round-result-grid', wrongIndex));
    const correctCard = screen.getByTestId(gridCard('round-result-grid', plan[0].correctIndex));

    expect(wrongCard.props.accessibilityLabel).toMatch(/^Wrong pick:/);
    expect(correctCard.props.accessibilityLabel).toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', wrongIndex)).toHaveTextContent('✕');
    expect(verdictBadge('round-result-grid', plan[0].correctIndex)).toHaveTextContent('✓');

    // The wrong answer must not read as correct through any channel.
    expect(wrongCard.props.accessibilityLabel).not.toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', wrongIndex)).not.toHaveTextContent('✓');
  });

  it('marks a correct pick with the correct cue and keeps the rule visible', async () => {
    const { clock, plan } = await startNormalSession('verdict-correct');

    await pressCard(clock, plan[0].isSwitch, plan[0].correctIndex);

    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[plan[0].rule],
    );
    const correctCard = screen.getByTestId(gridCard('round-result-grid', plan[0].correctIndex));
    expect(correctCard.props.accessibilityLabel).toMatch(/^Correct:/);
    expect(verdictBadge('round-result-grid', plan[0].correctIndex)).toHaveTextContent('✓');
  });

  it('names the rule in the feedback banner after an uncued miss', async () => {
    const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal;
    let seed = '';
    let uncuedIndex = -1;
    for (let s = 0; s < 50; s += 1) {
      seed = `verdict-uncued-${s}`;
      const candidate = generateSession(seed, params);
      const idx = candidate.findIndex((r) => r.uncued);
      if (idx > 0 && !candidate[idx].isSwitch) {
        uncuedIndex = idx;
        break;
      }
    }
    expect(uncuedIndex).toBeGreaterThan(0);
    const plan = generateSession(seed, params);
    const { clock } = await renderScreen(seed);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let round = 0; round < uncuedIndex; round += 1) {
      await pressCard(clock, plan[round].isSwitch, plan[round].correctIndex);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }

    const wrongIndex =
      (plan[uncuedIndex].correctIndex + 1) % plan[uncuedIndex].candidates.length;
    await pressCard(clock, plan[uncuedIndex].isSwitch, wrongIndex);

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    // The scored round reveals the rule in the banner as well as the reveal line.
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[plan[uncuedIndex].rule],
    );
    expect(screen.getByTestId(testId(GAME_ID, 'rule-reveal'))).toHaveTextContent(
      `The active rule was: ${RULE_LABELS[plan[uncuedIndex].rule]}`,
    );
  });
});
