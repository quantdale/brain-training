/**
 * CardSortScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → rule blocks → rule-switch notice → rounds
 * → results → persistence. Pause freeze semantics (including response-time
 * exclusion) and the dev-only QA force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { RULE_LABELS } from '../components/rule-banner';
import { generateRound, pickInitialRule } from '../generator';
import { flexibilityParamsForLevel } from '../difficulty';
import CardSortScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID, otherRule } from '../types';
import type { Card, FlexibilityRawResult, GeneratedRound, RuleId } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NOTICE_MS = 2000; // easy

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
    <CardSortScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the jest timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/**
 * Replay the deterministic generator for a fixed-level session: rules
 * alternate per block from the seed's initial rule, targets chain.
 */
function expectedRounds(seed: string, level: Exclude<DifficultyLevel, 'adaptive'>): GeneratedRound[] {
  const params = flexibilityParamsForLevel(level);
  const initialRule = pickInitialRule(createRng(seed));
  const rounds: GeneratedRound[] = [];
  let prevTarget: Card | null = null;
  for (let roundIndex = 0; roundIndex < params.rounds; roundIndex += 1) {
    const block = Math.floor(roundIndex / params.switchEvery);
    const rule: RuleId = block % 2 === 0 ? initialRule : otherRule(initialRule);
    const round = generateRound({
      rng: createRng(seed),
      roundIndex,
      rule,
      numShapes: params.numShapes,
      numColors: params.numColors,
      prevTarget,
    });
    rounds.push(round);
    prevTarget = round.target;
  }
  return rounds;
}

async function startRound(seed: string, level: Exclude<DifficultyLevel, 'adaptive'> = 'easy') {
  const view = await renderScreen({ seed });
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', level)));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  return view;
}

async function pickCorrect(round: GeneratedRound) {
  await fireEvent.press(
    screen.getByTestId(`${testId(GAME_ID, 'card-grid')}.card.${round.correctIndex}`),
  );
}

describe('CardSortScreen', () => {
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
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'target-card'))).toBeOnTheScreen();
    expect(screen.getByTestId(`${testId(GAME_ID, 'card-grid')}.card.0`)).toBeOnTheScreen();
    expect(screen.getByTestId(`${testId(GAME_ID, 'card-grid')}.card.3`)).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, walks the rule-switch demo, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const rng = createRng(TUTORIAL_DEMO_SEED);
    const demoRound1 = generateRound({
      rng,
      roundIndex: 0,
      rule: 'color',
      numShapes: 3,
      numColors: 3,
      prevTarget: null,
    });
    const demoRound2 = generateRound({
      rng,
      roundIndex: 1,
      rule: 'shape',
      numShapes: 3,
      numColors: 3,
      prevTarget: demoRound1.target,
    });

    // Demo round 1: match by color.
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/by color/);
    await fireEvent.press(
      screen.getByTestId(`${testId(GAME_ID, 'tutorial-grid')}.card.${demoRound1.correctIndex}`),
    );

    // The rule-switch notice teaches the transition to shape.
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-notice'))).toHaveTextContent(
      RULE_LABELS.shape,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-notice-continue')));

    // Demo round 2: now match by shape.
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/by shape/);
    await fireEvent.press(
      screen.getByTestId(`${testId(GAME_ID, 'tutorial-grid')}.card.${demoRound2.correctIndex}`),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(
      <CardSortScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />,
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

  it('plays a full easy session across a rule switch and persists the record', async () => {
    const seed = 'screen-easy-seed';
    const { clock, persister } = await startRound(seed, 'easy');
    const rounds = expectedRounds(seed, 'easy'); // 8 rounds, 4+4 blocks

    for (let round = 0; round < 4; round += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
        RULE_LABELS[rounds[round].rule],
      );
      await pickCorrect(rounds[round]);
      expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }

    // Block boundary: the explicit rule-switch notice appears with the new rule.
    expect(screen.getByTestId(testId(GAME_ID, 'switch-notice'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'switch-notice-rule'))).toHaveTextContent(
      RULE_LABELS[rounds[4].rule],
    );

    // The notice auto-expires on the SDK-monotonic-clock timer.
    await advanceTime(clock, NOTICE_MS);
    expect(screen.queryByTestId(testId(GAME_ID, 'switch-notice'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '5'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[rounds[4].rule],
    );

    for (let round = 4; round < 8; round += 1) {
      await pickCorrect(rounds[round]);
      if (round < 7) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }

    // Final round: the result card's button leads to the results screen.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'switch-accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'best-streak'))).toHaveTextContent('8');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('flexibility-card-sort');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(NOTICE_MS); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as FlexibilityRawResult;
    expect(raw.score).toBe(8 * 150); // 100 + full speed bonus per round
    expect(raw.postSwitchPlayed).toBe(1);
    expect(raw.postSwitchCorrect).toBe(1);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('easy');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'easy', challengeRating: 0.2 }),
    );
  });

  it('lets the player skip the notice with tap-to-continue', async () => {
    const seed = 'notice-tap';
    const { clock } = await startRound(seed, 'easy');
    const rounds = expectedRounds(seed, 'easy');

    for (let round = 0; round < 4; round += 1) {
      await pickCorrect(rounds[round]);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'switch-notice'))).toBeOnTheScreen();

    // Tap continue before the timer elapses.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'switch-notice-continue')));
    expect(screen.queryByTestId(testId(GAME_ID, 'switch-notice'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '5'))).toBeOnTheScreen();
    expect(clock.now()).toBe(0); // no wall time was consumed
  });

  it('fails the round on a wrong pick and shows the correct match', async () => {
    const seed = 'wrong-pick';
    await startRound(seed, 'easy');
    const rounds = expectedRounds(seed, 'easy');

    const wrong = (rounds[0].correctIndex + 1) % 4;
    await fireEvent.press(screen.getByTestId(`${testId(GAME_ID, 'card-grid')}.card.${wrong}`));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');
    const correctCard = rounds[0].candidates[rounds[0].correctIndex];
    expect(screen.getByTestId(testId(GAME_ID, 'round-explainer'))).toHaveTextContent(
      new RegExp(`The match was ${correctCard.color} ${correctCard.shape}`),
    );

    // The next round continues under the same rule (no switch mid-block).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[rounds[1].rule],
    );
  });

  it('pauses: the opaque overlay appears, timers freeze, and response time excludes the pause', async () => {
    const { clock } = await startRound('pause-test', 'normal');
    const rounds = expectedRounds('pause-test', 'normal');

    await advanceTime(clock, 1000); // 1s of thinking time
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('flexibility-card-sort.pause-overlay')).toBeOnTheScreen();

    // Frozen: elapsed background time must not count toward the response time.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId('flexibility-card-sort.pause-overlay')).toBeNull();

    // Pick immediately: responseMs ≈ 1000 → speed bonus 50*(1 - 1000/5000) = 40.
    await pickCorrect(rounds[0]);
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 140');
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await startRound('qa-win', 'normal');

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as FlexibilityRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await startRound('qa-lose', 'normal');

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('0%');
    expect(screen.getByTestId(testId(GAME_ID, 'mistakes'))).toHaveTextContent('1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as FlexibilityRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
