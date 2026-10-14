import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import type { GameHostProps } from '@/components/game-host';
import type { CompleteSessionInput } from '@/db';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';
import { RUNNING_ORDER_DIFFICULTY_PARAMS } from '../difficulty';
import { generateStream, streamTarget } from '../generator';
import GameScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));
let mockHost: GameHostProps;
jest.mock('@/components/game-host', () => {
  const actual = jest.requireActual<typeof import('@/components/game-host')>('@/components/game-host');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameHost: (props: GameHostProps) => { mockHost = props; return React.createElement(actual.GameHost, props); } };
});
const NORMAL = RUNNING_ORDER_DIFFICULTY_PARAMS.normal;
const SEED = '077-running-input';
const STREAM = generateStream({ rng: createRng(SEED), roundIndex: 0, streamLen: NORMAL.streamLen, recallLength: NORMAL.initialRecallLength, prevTarget: null });
const TARGET = streamTarget(STREAM, NORMAL.initialRecallLength);
function event() { return { nativeEvent: { timestamp: 123, target: 1 } } as unknown as GestureResponderEvent; }
async function press(part: string, index = '') { await fireEvent.press(screen.getByTestId(testId(GAME_ID, part, index))); }
function capture(part: string, index = '') {
  let fiber = screen.getByTestId(testId(GAME_ID, part, index)).unstable_fiber;
  while (fiber !== null) { if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress as (event?: GestureResponderEvent) => void; fiber = fiber.return; }
  throw new Error(`Missing actual ${part} callback`);
}
async function setup(autoStart = true) {
  const timeouts = jest.spyOn(global, 'setTimeout'); const clock = createFakeClock();
  const store = createInMemoryTutorialStore(); store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
  await render(<GameScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={{ completeSession }} />); if (autoStart) await press('start');
  const timer = (delay = NORMAL.flashMs) => {
    const callback = timeouts.mock.calls.filter((call) => call[1] === delay).at(-1)?.[0];
    if (typeof callback !== 'function') throw new Error(`Missing actual reveal timeout ${delay}`);
    return callback as () => void;
  };
  const advance = async (ms: number) => { await act(async () => { clock.advance(ms); }); };
  const input = async () => { for (let index = 0; index < NORMAL.streamLen; index += 1) {
    await advance(NORMAL.flashMs); await act(async () => { jest.advanceTimersByTime(NORMAL.flashMs); });
  } };
  return { clock, timer, advance, input };
}
function revealPosition() { return screen.getByTestId(testId(GAME_ID, 'progress')).props.accessibilityLabel; }

describe('Running Order actual reveal and known-input ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.spyOn(liveAudioHaptics, 'feedback').mockImplementation(() => {}); });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

  it('accepts distinct known suffix picks in one batch, then enables the actual submit control', async () => {
    const { input } = await setup(); await input();
    const picks = TARGET.map((id) => capture('palette', String(id)));
    await act(async () => { picks.forEach((pick) => pick(event())); });
    await press('submit');
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });

  it('ignores a repeated physical palette event but accepts a new known symbol', async () => {
    const { input } = await setup(); await input(); const first = event();
    const option = (id: number) => screen.getByTestId(testId(GAME_ID, 'palette', String(id)));
    await fireEvent(option(TARGET[0]), 'press', first);
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await fireEvent(option(TARGET[0]), 'press', { ...first, nativeEvent: first.nativeEvent });
    expect(screen.queryByTestId(testId(GAME_ID, 'answer', '1'))).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    for (const id of TARGET.slice(1)) await fireEvent(option(id), 'press', event());
    await press('submit'); expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });

  it('keeps early and repeated old reveal callbacks from skipping an unseen symbol', async () => {
    const { timer, advance } = await setup(); const queued = timer();
    await act(async () => queued());
    expect(revealPosition()).toBe(`Item 1 of ${NORMAL.streamLen}`);
    await advance(NORMAL.flashMs);
    await act(async () => { queued(); queued(); queued(); });
    expect(revealPosition()).toBe(`Item 2 of ${NORMAL.streamLen}`);
  });

  it('anchors each new symbol at its delayed display commit', async () => {
    const { timer, advance, clock } = await setup(); const queued = timer();
    await advance(NORMAL.flashMs);
    await act(async () => { queued(); clock.advance(5000); });
    const current = timer(); await act(async () => current());
    expect(revealPosition()).toBe(`Item 2 of ${NORMAL.streamLen}`);
    await advance(NORMAL.flashMs); await act(async () => current());
    expect(revealPosition()).toBe(`Item 3 of ${NORMAL.streamLen}`);
  });

  it('cancels the old timeout across pause and retains the exact remaining flash', async () => {
    const { timer, advance } = await setup(); const old = timer();
    await advance(333); await press('pause'); await advance(10_000); await press('resume');
    await advance(NORMAL.flashMs - 333);
    await act(async () => old());
    expect(revealPosition()).toBe(`Item 1 of ${NORMAL.streamLen}`);
    await act(async () => timer(NORMAL.flashMs - 333)());
    expect(revealPosition()).toBe(`Item 2 of ${NORMAL.streamLen}`);
  });

  it('retires a palette callback at pause and after a different round mounts', async () => {
    const { input } = await setup(); await input(); const old = capture('palette', String(TARGET[0]));
    await act(async () => { mockHost.onPause(); old(event()); }); await press('resume');
    await act(async () => old(event()));
    expect(screen.queryByTestId(testId(GAME_ID, 'answer', '0'))).toBeNull();
    for (const id of TARGET) await press('palette', String(id)); await press('submit'); await press('next-round'); await input();
    jest.mocked(liveAudioHaptics.feedback).mockClear(); await act(async () => old(event()));
    expect(screen.queryByTestId(testId(GAME_ID, 'answer', '0'))).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('does not sound ignored input after the answer is full or empty backspace', async () => {
    const { input } = await setup(); await input(); const pick = capture('palette', String(TARGET[0]));
    await press('palette', String(TARGET[0])); const back = capture('backspace'); await press('backspace');
    jest.mocked(liveAudioHaptics.feedback).mockClear();
    await act(async () => back()); expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
    for (const id of TARGET) await press('palette', String(id));
    jest.mocked(liveAudioHaptics.feedback).mockClear(); await act(async () => pick(event()));
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('makes a queued palette event inert after abandonment', async () => {
    const { input } = await setup(); await input(); const old = capture('palette', String(TARGET[0]));
    await act(async () => { mockHost.onQuit(); old(event()); });
    expect(screen.queryByTestId(testId(GAME_ID, 'answer', '0'))).toBeNull();
    expect(liveAudioHaptics.feedback).not.toHaveBeenCalled();
  });

  it('accepts rapid distinct last-two tutorial picks without losing the first', async () => {
    const clock = createFakeClock(); await render(<GameScreen clock={clock} tutorialStore={createInMemoryTutorialStore()} />); await press('tutorial-next');
    for (let index = 0; index < 3; index += 1) await act(async () => { clock.advance(800); jest.advanceTimersByTime(800); });
    const first = capture('tutorial-palette', '1'); const second = capture('tutorial-palette', '2');
    await act(async () => { first(event()); second(event()); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });

  it('does not promise a tutorial replay when a wrong answer only clears the picks', async () => {
    const clock = createFakeClock(); await render(<GameScreen clock={clock} tutorialStore={createInMemoryTutorialStore()} />); await press('tutorial-next');
    for (let index = 0; index < 3; index += 1) await act(async () => { clock.advance(800); jest.advanceTimersByTime(800); });
    await press('tutorial-palette', '0'); await press('tutorial-palette', '0');
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-feedback'))).not.toHaveTextContent(/watch again/i);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-palette'))).toBeOnTheScreen();
  });
  it('retires an intro Start across completion but accepts the newly rendered restart', async () => {
    await setup(false);
    const oldStart = capture('start');
    await press('start'); await press('qa-toggle'); await press('force-lose');
    await act(async () => oldStart());
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    await press('restart');
    expect(screen.queryByTestId(testId(GAME_ID, 'results'))).toBeNull();
  });

  it('claims Help before a retained same-batch Start can begin under the tutorial', async () => {
    await setup(false);
    const oldStart = capture('start');
    const help = capture('help');
    await act(async () => { help(); oldStart(); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await press('tutorial-skip');
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    await press('start');
    expect(screen.queryByTestId(testId(GAME_ID, 'intro'))).toBeNull();
  });

});
