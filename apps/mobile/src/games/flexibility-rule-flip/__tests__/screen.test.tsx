/**
 * RuleFlipScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → trials (with rule-flip arm windows) → results →
 * persistence. Pause freeze semantics, the tutorial lifecycle, and the
 * dev-only QA force paths are covered too. The full playthrough replays the
 * exact plan from `generateSession(seed)` — a screen-level seed-determinism
 * check.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  testId,
} from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound, generateSession } from '../generator';
import { perfectPlanScore } from '../scoring';
import RuleFlipScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID, RULE_LABELS } from '../types';
import type { FlexibilityRuleFlipRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const ARM_MS = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal.switchArmMs; // 800

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, {
    completed: true,
    replayRequested: false,
    version: '1.0.0',
  });
  return store;
}

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: 0,
  }));
  return { completeSession } as SessionPersistence & {
    completeSession: jest.Mock;
  };
}

async function renderScreen(
  options: {
    seed?: string;
    store?: ReturnType<typeof createInMemoryTutorialStore>;
    clock?: ReturnType<typeof createFakeClock>;
    persister?: ReturnType<typeof makePersister>;
  } = {},
) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <RuleFlipScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Press the correct card of the current trial, honoring the switch arm window. */
async function answerCorrect(
  clock: ReturnType<typeof createFakeClock>,
  plan: ReturnType<typeof generateSession>,
  roundIndex: number,
) {
  if (plan[roundIndex].isSwitch) {
    await advanceTime(clock, ARM_MS); // let the post-flip arm window elapse
  }
  await fireEvent.press(
    screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(plan[roundIndex].correctIndex))),
  );
}

/** Start an easy-tier session (the always-cued tier) on the rendered screen. */
async function startEasySession(seed: string) {
  await renderScreen({ seed });
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
}

describe('RuleFlipScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro with difficulty options and starts a session', async () => {
    const seed = 'intro';
    await renderScreen({ seed });
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'help'))).toBeOnTheScreen();
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId(GAME_ID, 'difficulty', level))).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.expert;
    const plan = generateSession(seed, params);
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[plan[0].rule],
    );
    expect(screen.getByTestId(testId(GAME_ID, 'target-card'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    // Exactly CANDIDATE_COUNT cards are offered.
    for (let i = 0; i < 4; i += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(i)))).toBeOnTheScreen();
    }
    expect(screen.queryByTestId(testId(GAME_ID, 'card-grid', 'card', '4'))).toBeNull();
    // No answer leak: no candidate is marked selected before an answer.
    for (let i = 0; i < 4; i += 1) {
      const card = screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(i)));
      expect(card.props.accessibilityState?.selected ?? false).toBeFalsy();
    }
  });

  it('opens the tutorial on first play, completes the demo, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const clock = createFakeClock(0);
    const { result } = await renderScreen({ seed: 'tut', store, clock });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = generateRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      rule: 'color',
      isSwitch: false,
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      prevTarget: null,
    });
    // A wrong tap offers "clear and retry"; then the correct tap completes the demo.
    const wrongIndex = (demo.correctIndex + 1) % demo.candidates.length;
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'tutorial-grid', 'card', String(wrongIndex))),
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-demo-done'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-retry')));
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'tutorial-grid', 'card', String(demo.correctIndex))),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-done')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // Completed: a remount does not auto-open the tutorial…
    await result.unmount();
    await render(
      <RuleFlipScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // …but "How to play" still replays it on demand.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('skips the tutorial via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end, matching the seeded plan, and persists the record', async () => {
    const seed = 'screen-test-seed';
    const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal;
    const plan = generateSession(seed, params);
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    for (let round = 0; round < plan.length; round += 1) {
      await answerCorrect(clock, plan, round);
      // The final "See results" press also runs through next-round.
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'mistakes'))).toHaveTextContent('0');

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('flexibility-rule-flip');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThan(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as FlexibilityRuleFlipRawResult;
    expect(raw.score).toBe(perfectPlanScore(plan));
    expect(raw.totalRounds).toBe(plan.length);
    expect(raw.switchPlayed).toBe(plan.filter((r) => r.isSwitch).length);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.1.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('scores a wrong pick as a mistake but lets the session continue', async () => {
    const seed = 'wrong-tap';
    const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal;
    const plan = generateSession(seed, params);
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // Round 1: deliberate wrong pick (never a switch trial).
    const wrongIndex = (plan[0].correctIndex + 1) % plan[0].candidates.length;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(wrongIndex))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-result-grid'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));

    // Remaining rounds: correct.
    for (let round = 1; round < plan.length; round += 1) {
      await answerCorrect(clock, plan, round);
      // The final "See results" press also runs through next-round.
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'mistakes'))).toHaveTextContent('1');
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('90%');
  });

  it('pauses: opaque overlay appears, input freezes, and paused time is never charged', async () => {
    const seed = 'pause-test';
    const plan = generateSession(seed, FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal);
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 300); // partway into trial 1 (a repeat trial)

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(`${GAME_ID}.pause-overlay`)).toBeOnTheScreen();
    // Opaque pause contract: the board is hidden from the accessibility tree.
    expect(screen.queryByTestId(testId(GAME_ID, 'card-grid', 'card', '0'))).toBeNull();

    // Background time must not charge the trial's response clock.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(`${GAME_ID}.pause-overlay`)).toBeNull();

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(plan[0].correctIndex))),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    // responseMs = 300 pre-pause active ms → 100 + 50*(1 - 300/5000) = 147.
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 147');
  });

  it('shifts the switch arm window by the pause duration', async () => {
    const seed = 'arm-shift';
    const plan = generateSession(seed, FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal);
    const switchIndex = plan.findIndex((r) => r.isSwitch);
    expect(switchIndex).toBeGreaterThan(0);
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let round = 0; round < switchIndex; round += 1) {
      await answerCorrect(clock, plan, round);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }

    // Pause INSIDE the arm window right after the flip cue.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));

    // The arm deadline shifted with the pause: an immediate pick is still locked.
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(plan[switchIndex].correctIndex))),
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'round-result'))).toBeNull();

    // Once the (shifted) window elapses, the pick lands.
    await advanceTime(clock, ARM_MS);
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(plan[switchIndex].correctIndex))),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
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
    expect((input.session.rawResult as FlexibilityRuleFlipRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'mistakes'))).toHaveTextContent('1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as FlexibilityRuleFlipRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('force-timeout ends the session without scoring the in-flight trial', async () => {
    const seed = 'qa-timeout';
    const plan = generateSession(seed, FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal);
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Complete trial 1, advance to trial 2 (in flight).
    await answerCorrect(clock, plan, 0);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-force-timeout')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as FlexibilityRuleFlipRawResult;
    expect(raw.forced).toBe(true);
    expect(raw.roundsPlayed).toBe(1); // in-flight trial NOT scored
    expect(raw.totalRounds).toBe(plan.length);
  });

  it('hides the rule banner on uncued trials and reveals the rule on a miss', async () => {
    // Pick a seed whose first uncued trial arrives early and is NOT a switch.
    const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal;
    let seed = '';
    let uncuedIndex = -1;
    for (let s = 0; s < 50; s += 1) {
      seed = `uncue-screen-${s}`;
      const candidate = generateSession(seed, params);
      const idx = candidate.findIndex((r) => r.uncued);
      if (idx > 0 && !candidate[idx].isSwitch) {
        uncuedIndex = idx;
        break;
      }
    }
    expect(uncuedIndex).toBeGreaterThan(0);
    const plan = generateSession(seed, params);
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let round = 0; round < uncuedIndex; round += 1) {
      await answerCorrect(clock, plan, round);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }

    // The dark window: placeholder instead of the rule, no flip announcement,
    // no leak via the pick status line.
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-uncued'))).toHaveTextContent(
      /Infer the active rule/,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'rule-banner-text'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'rule-switch'))).toBeNull();

    // A wrong pick must reveal which rule was active (the teaching signal).
    const wrongIndex = (plan[uncuedIndex].correctIndex + 1) % plan[uncuedIndex].candidates.length;
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'card-grid', 'card', String(wrongIndex))),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'rule-reveal'))).toHaveTextContent(
      `The active rule was: ${RULE_LABELS[plan[uncuedIndex].rule]}`,
    );
  });

  it('confirms a correct uncued inference silently (no dedicated rule reveal)', async () => {
    const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal;
    let seed = '';
    let uncuedIndex = -1;
    for (let s = 0; s < 50; s += 1) {
      seed = `uncue-ok-${s}`;
      const candidate = generateSession(seed, params);
      const idx = candidate.findIndex((r) => r.uncued);
      if (idx > 0 && !candidate[idx].isSwitch) {
        uncuedIndex = idx;
        break;
      }
    }
    const plan = generateSession(seed, params);
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let round = 0; round < uncuedIndex; round += 1) {
      await answerCorrect(clock, plan, round);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }
    await answerCorrect(clock, plan, uncuedIndex);
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    // Silent confirmation: the standard explainer stays, but no extra reveal.
    expect(screen.queryByTestId(testId(GAME_ID, 'rule-reveal'))).toBeNull();
  });

  it('keeps easy fully cued: every trial shows the labeled banner', async () => {
    const seed = 'easy-cued';
    const params = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.easy;
    const plan = generateSession(seed, params);
    expect(plan.every((r) => !r.uncued)).toBe(true);
    await startEasySession(seed);
    expect(screen.getByTestId(testId(GAME_ID, 'rule-banner-text'))).toHaveTextContent(
      RULE_LABELS[plan[0].rule],
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'rule-banner-uncued'))).toBeNull();
  });
});
