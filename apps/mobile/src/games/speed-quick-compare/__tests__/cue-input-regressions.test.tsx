import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps, ComponentType } from 'react';
import type { CompleteSessionInput } from '@/db';
import { createFakeClock, createInMemoryTutorialStore, liveAudioHaptics, testId } from '@/sdk';

import QuickScreen from '../screen';
import type { QuickCompareScreenProps } from '../screen';
import { quickCompareGameReducer as compareReducer, createInitialQuickCompareState } from '../reducer';
import OrderScreen from '../../speed-order-sweep/screen';
import { orderSweepGameReducer as orderReducer, createInitialOrderSweepState } from '../../speed-order-sweep/reducer';
import WordScreen from '../../language-word-chain/screen';
import { wordChainReducer as wordReducer, createInitialLanguageWordChainState } from '../../language-word-chain/reducer';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }) }));

// Retain the real presentation, while observing the real callback props that
// native Pressable's rendered host View does not expose to the test runner.
const mockPress = new Map<string, () => void>();
jest.mock('@/components/game-ui', () => {
  const actual = jest.requireActual<typeof import('@/components/game-ui')>('@/components/game-ui');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameButton: (props: ComponentProps<typeof actual.GameButton>) => {
    mockPress.set(props.testID, props.onPress);
    return React.createElement(actual.GameButton, props);
  } };
});
jest.mock('../components/comparison', () => {
  const actual = jest.requireActual<typeof import('../components/comparison')>('../components/comparison');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, Comparison: (props: ComponentProps<typeof actual.Comparison>) => {
    props.round.optionLabels.forEach((_, index) => mockPress.set(`speed-quick-compare.option.${index}`, () => props.onSelect(index)));
    return React.createElement(actual.Comparison, props);
  } };
});
jest.mock('../../speed-order-sweep/components/token-grid', () => {
  const actual = jest.requireActual<typeof import('../../speed-order-sweep/components/token-grid')>('../../speed-order-sweep/components/token-grid');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, TokenGrid: (props: ComponentProps<typeof actual.TokenGrid>) => {
    props.round.tokens.forEach((token) => mockPress.set(`speed-order-sweep.token.${token.value}`, () => props.onTap(token.id)));
    return React.createElement(actual.TokenGrid, props);
  } };
});
jest.mock('../../language-word-chain/components/option', () => {
  const actual = jest.requireActual<typeof import('../../language-word-chain/components/option')>('../../language-word-chain/components/option');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, Option: (props: ComponentProps<typeof actual.Option>) => {
    if (props.onPressOption) mockPress.set(`language-word-chain.option.${props.index}`, () => props.onPressOption?.(props.index));
    return React.createElement(actual.Option, props);
  } };
});

const SEED = '077-readonly-language-word-chain';
const START = { type: 'start-session' as const, seed: SEED, sessionId: 'plan', startedAtMs: 0 };
const compare = compareReducer(createInitialQuickCompareState(), { ...START, spawnedAtMs: 0 });
const order = orderReducer(createInitialOrderSweepState(), { ...START, roundStartedAtMs: 0 });
const word = wordReducer(createInitialLanguageWordChainState(), { ...START, nowMs: 0 });
const compareNext = compareReducer(compareReducer(compare, { type: 'answer', index: compare.round!.correctIndex, nowMs: 0 }), { type: 'next-round', spawnedAtMs: 0 });
let swept = order;
for (const value of order.round!.order) swept = orderReducer(swept, { type: 'tap', tokenId: order.round!.tokens.find((token) => token.value === value)!.id, nowMs: 0 });
const orderNext = orderReducer(swept, { type: 'next-round', roundStartedAtMs: 0 });
let linked = word;
for (const step of word.currentRound!.steps) linked = wordReducer(linked, { type: 'answer-step', index: step.correctIndex, nowMs: 0 });
const wordNext = wordReducer(linked, { type: 'next-round', nowMs: 0 });

interface Fixture {
  id: string;
  Screen: ComponentType<QuickCompareScreenProps>;
  budget: number;
  nextBudget: number;
  resultId: string;
  answerId: string;
  solve: () => Promise<void>;
}

const fixtures: Fixture[] = [
  { id: 'speed-quick-compare', Screen: QuickScreen, budget: compare.windowMs, nextBudget: compareNext.windowMs, resultId: 'feedback', answerId: `option.${compare.round!.correctIndex}`, solve: async () => {
    await fireEvent.press(screen.getByTestId(testId('speed-quick-compare', 'option', String(compare.round!.correctIndex))));
  } },
  { id: 'speed-order-sweep', Screen: OrderScreen, budget: order.windowMs, nextBudget: orderNext.windowMs, resultId: 'round-result', answerId: `token.${order.round!.order[0]}`, solve: async () => {
    for (const value of order.round!.order) await fireEvent.press(screen.getByTestId(testId('speed-order-sweep', 'token', String(value))));
  } },
  { id: 'language-word-chain', Screen: WordScreen, budget: word.roundBudgetMs, nextBudget: wordNext.roundBudgetMs, resultId: 'round-result', answerId: `option.${word.currentRound!.steps[0].correctIndex}`, solve: async () => {
    for (const step of word.currentRound!.steps) await fireEvent.press(screen.getByTestId(testId('language-word-chain', 'option', String(step.correctIndex))));
  } },
];

function spyTimeouts() { return jest.spyOn(global, 'setTimeout'); }
let timeoutSpy: ReturnType<typeof spyTimeouts>;
function timerAt(delay: number): () => void {
  const calls = timeoutSpy.mock.calls.filter((call) => call[1] === delay);
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as () => void;
}
function hasResult(fixture: Fixture) { return screen.queryByTestId(testId(fixture.id, fixture.resultId)) !== null; }
function nextId(fixture: Fixture) { return testId(fixture.id, fixture.id === 'speed-quick-compare' ? 'next' : 'next-round'); }
async function mount(fixture: Fixture, initialClockMs = 0) {
  const clock = createFakeClock(initialClockMs);
  const store = createInMemoryTutorialStore();
  store.setTutorialState(fixture.id, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(<fixture.Screen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />);
  await fireEvent.press(screen.getByTestId(testId(fixture.id, 'start')));
  return { clock, completeSession, expire: timerAt(fixture.budget) };
}

describe('remaining cue input: real scheduled and rendered callers', () => {
  beforeEach(() => { jest.useFakeTimers(); timeoutSpy = spyTimeouts(); mockPress.clear(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it.each(fixtures)('$id ignores an early callback delivered at 1ms and emits no failure feedback', async (fixture) => {
    const { clock, expire } = await mount(fixture);
    const audio = jest.spyOn(liveAudioHaptics, 'feedback');
    clock.advance(1);
    await act(async () => expire());
    expect(hasResult(fixture)).toBe(false);
    expect(audio).not.toHaveBeenCalled();
  });

  it.each(fixtures)('$id rejects an old expiry from before pause/resume even when the current deadline is due', async (fixture) => {
    const { clock, expire } = await mount(fixture);
    clock.advance(50);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    clock.advance(5000);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
    const resumedExpiry = timerAt(fixture.budget - 50);
    clock.advance(fixture.budget - 50);
    const audio = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => expire());
    expect(hasResult(fixture)).toBe(false);
    expect(audio).not.toHaveBeenCalled();
    await act(async () => resumedExpiry());
    expect(hasResult(fixture)).toBe(true);
  });

  it.each(fixtures)('$id rejects an old round expiry after a new round reaches its own deadline', async (fixture) => {
    const { clock, expire } = await mount(fixture);
    await fixture.solve();
    await fireEvent.press(screen.getByTestId(nextId(fixture)));
    const nextExpiry = timerAt(fixture.nextBudget);
    clock.advance(fixture.nextBudget);
    const audio = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => expire());
    expect(hasResult(fixture)).toBe(false);
    expect(audio).not.toHaveBeenCalled();
    await act(async () => nextExpiry());
    expect(hasResult(fixture)).toBe(true);
  });

  it.each(fixtures)('$id invalidates old answer callbacks across pause/resume', async (fixture) => {
    const { clock } = await mount(fixture);
    const oldPress = mockPress.get(`${fixture.id}.${fixture.answerId}`)!;
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    clock.advance(5000);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'speed-quick-compare' ? 'playSfx' : 'feedback');
    await act(async () => oldPress());
    expect(audio).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.answerId}`));
    expect(audio).toHaveBeenCalledTimes(1);
  });

  it.each(fixtures)('$id rejects queued expiry and input after quit', async (fixture) => {
    const { clock, expire } = await mount(fixture);
    const oldPress = mockPress.get(`${fixture.id}.${fixture.answerId}`)!;
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'quit')));
    clock.advance(fixture.budget + 5000);
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'speed-quick-compare' ? 'playSfx' : 'feedback');
    await act(async () => { expire(); oldPress(); });
    expect(audio).not.toHaveBeenCalled();
    expect(hasResult(fixture)).toBe(false);
  });

  it.each(fixtures)('$id rejects old callbacks after restart even when its new window is due', async (fixture) => {
    const { clock, expire } = await mount(fixture);
    const oldPress = mockPress.get(`${fixture.id}.${fixture.answerId}`)!;
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'force-win')));
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'restart')));
    clock.advance(fixture.budget);
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'speed-quick-compare' ? 'playSfx' : 'feedback');
    await act(async () => { expire(); oldPress(); });
    expect(audio).not.toHaveBeenCalled();
    expect(hasResult(fixture)).toBe(false);
  });

  it.each(fixtures)('$id resolves a strictly deadline-expired answer immediately during a JS stall without correct feedback', async (fixture) => {
    const { clock } = await mount(fixture);
    clock.advance(fixture.budget + 0.25);
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'speed-quick-compare' ? 'playSfx' : 'feedback');
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.answerId}`));
    expect(hasResult(fixture)).toBe(true);
    expect(audio).not.toHaveBeenCalledWith('correct');
  });

  it.each(fixtures)('$id accepts fractional positive time before its exact deadline', async (fixture) => {
    const { clock } = await mount(fixture);
    clock.advance(fixture.budget - 0.25);
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'speed-quick-compare' ? 'playSfx' : 'feedback');
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.answerId}`));
    expect(audio).toHaveBeenCalledWith('correct');
  });

  it.each(fixtures)('$id uses the session active clock independently of the injected clock origin', async (fixture) => {
    const { clock, expire } = await mount(fixture, 100_000);
    clock.advance(1);
    await act(async () => expire());
    expect(hasResult(fixture)).toBe(false);
    const audio = jest.spyOn(liveAudioHaptics, fixture.id === 'speed-quick-compare' ? 'playSfx' : 'feedback');
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.answerId}`));
    expect(audio).toHaveBeenCalledWith('correct');
  });

  it.each(fixtures)('$id preserves a fractional remaining window and expires at its actual active deadline', async (fixture) => {
    const { clock } = await mount(fixture);
    await act(async () => { clock.advance(50); jest.advanceTimersByTime(50); });
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    await act(async () => { clock.advance(5000); jest.advanceTimersByTime(5000); });
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
    await act(async () => { clock.advance(fixture.budget - 51); jest.advanceTimersByTime(fixture.budget - 51); });
    expect(hasResult(fixture)).toBe(false);
    await act(async () => { clock.advance(1); jest.advanceTimersByTime(1); });
    expect(hasResult(fixture)).toBe(true);
  });

  it('Quick Compare persists the whole pre/post-pause reaction instead of a paused segment', async () => {
    const fixture = fixtures[0];
    const { clock, completeSession } = await mount(fixture, 100_000);
    clock.advance(1375);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    clock.advance(5000);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
    clock.advance(625);
    let planned = compare;
    for (let round = 0; round < compare.stats.roundsTotal; round += 1) {
      const index = planned.round!.correctIndex;
      await fireEvent.press(screen.getByTestId(testId(fixture.id, 'option', String(index))));
      planned = compareReducer(planned, { type: 'answer', index, nowMs: planned.roundStartedAtMs ?? 0 });
      await fireEvent.press(screen.getByTestId(nextId(fixture)));
      if (round + 1 < compare.stats.roundsTotal) planned = compareReducer(planned, { type: 'next-round', spawnedAtMs: 0 });
    }
    await act(async () => {});
    expect(completeSession).toHaveBeenCalledTimes(1);
    const raw = completeSession.mock.calls[0][0].session.rawResult as { reactions: number[]; diagnosticMetadata: { pausedDurationMs: number }; scoringVersion: string };
    expect(raw.reactions).toEqual([2000, ...Array.from({ length: compare.stats.roundsTotal - 1 }, () => 0)]);
    expect(raw.diagnosticMetadata.pausedDurationMs).toBe(5000);
    expect(raw.scoringVersion).toBe('1.1.0');
    expect(raw).not.toHaveProperty('inputEpoch');
  });

  it.each(fixtures.slice(1))('$id persists continuous active answer time across a pause and JS stalls', async (fixture) => {
    const { clock, completeSession } = await mount(fixture, 100_000);
    clock.advance(1375);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    clock.advance(5000);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
    clock.advance(625);
    await fireEvent.press(screen.getByTestId(`${fixture.id}.${fixture.answerId}`));
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'force-lose')));
    await act(async () => {});
    const raw = completeSession.mock.calls[0][0].session.rawResult as { gaps: number[]; totalAnswerMs: number; stepsPlayed: number; stepsCorrect: number };
    if (fixture.id === 'speed-order-sweep') expect(raw.gaps).toEqual([2000]);
    else {
      expect(raw.totalAnswerMs).toBe(2000);
      expect(raw.stepsPlayed).toBe(1);
      expect(raw.stepsCorrect).toBe(1);
    }
    expect(raw).not.toHaveProperty('inputEpoch');
  });

  it.each(fixtures.slice(0, 2))('$id rejects a queued Next while its result is paused', async (fixture) => {
    await mount(fixture);
    await fixture.solve();
    const oldNext = mockPress.get(nextId(fixture))!;
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'pause')));
    await act(async () => oldNext());
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'resume')));
    expect(screen.queryByTestId(testId(fixture.id, 'round', '1'))).not.toBeNull();
    expect(screen.queryByTestId(testId(fixture.id, 'round', '2'))).toBeNull();
  });

  it('Word Chain does not replay the first rendered answer into an unseen next link', async () => {
    const fixture = fixtures[2];
    await mount(fixture);
    expect(word.currentRound!.steps.map((step) => step.correctIndex)).toEqual([3, 1, 2]);
    const first = mockPress.get('language-word-chain.option.3')!;
    const unseenSecond = mockPress.get('language-word-chain.option.1')!;
    const audio = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => { first(); first(); unseenSecond(); });
    expect(hasResult(fixture)).toBe(false);
    expect(screen.getByTestId('language-word-chain.progress').props.accessibilityLabel).toBe('1 of 3 links filled');
    expect(audio).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('language-word-chain.option.1'));
    expect(screen.getByTestId('language-word-chain.progress').props.accessibilityLabel).toBe('2 of 3 links filled');
  });

  it('Word Chain ignores a first-step callback replayed after the next step rendered', async () => {
    const fixture = fixtures[2];
    await mount(fixture);
    const first = mockPress.get('language-word-chain.option.3')!;
    await fireEvent.press(screen.getByTestId('language-word-chain.option.3'));
    const audio = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => first());
    expect(hasResult(fixture)).toBe(false);
    expect(audio).not.toHaveBeenCalled();
    expect(screen.getByTestId('language-word-chain.progress').props.accessibilityLabel).toBe('1 of 3 links filled');
  });

  it('Order Sweep accepts rapid distinct visible tokens and ignores a duplicate cleared token', async () => {
    await mount(fixtures[1]);
    const [firstValue, secondValue] = order.round!.order;
    const first = mockPress.get(`speed-order-sweep.token.${firstValue}`)!;
    const second = mockPress.get(`speed-order-sweep.token.${secondValue}`)!;
    const audio = jest.spyOn(liveAudioHaptics, 'feedback');
    await act(async () => { first(); first(); second(); });
    expect(screen.getByTestId('speed-order-sweep.grid').props.accessibilityLabel).toBe('2 of 9 numbers swept');
    expect(audio).toHaveBeenCalledTimes(2);
    expect(audio).not.toHaveBeenCalledWith('wrong');
  });

  it('Quick Compare emits feedback once for duplicate callbacks in one React batch', async () => {
    const fixture = fixtures[0];
    await mount(fixture);
    const first = mockPress.get(`${fixture.id}.${fixture.answerId}`)!;
    const audio = jest.spyOn(liveAudioHaptics, 'playSfx');
    await act(async () => { first(); first(); });
    expect(audio).toHaveBeenCalledTimes(1);
  });
});
