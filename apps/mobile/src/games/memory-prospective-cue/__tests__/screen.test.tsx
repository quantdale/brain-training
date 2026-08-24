/**
 * SignalWatchScreen integration tests.
 *
 * Campaign 013 hardening regressions for the per-item response window,
 * driven through the real screen with injected seams (fake clock, completed
 * tutorial store, fixed seed, fake persister) and jest fake timers:
 *
 * 1. Press-path freshness — the GO speed bonus must use the elapsed
 *    fraction AT PRESS TIME. Regression: the memoized `handleRespond`
 *    closed over render state captured at round start, so every mid-round
 *    press read fraction 0 and paid the maximum speed bonus.
 * 2. Freeze-and-continue — pausing freezes the window and resuming
 *    continues the REMAINING window. Regression: the pacing effect
 *    re-created its local accumulator at 0 on resume, silently granting a
 *    fresh full window after every pause/tutorial cycle (contradicting the
 *    documented contract).
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  noopAudioHaptics,
  setLiveAudioHaptics,
  testId,
} from "@/sdk";
import type { CompleteSessionInput } from "@/db";

import { PROSPECTIVE_CUE_DIFFICULTY_PARAMS } from "../difficulty";
import { GO_HIT_POINTS, GO_SPEED_BONUS, SIGNAL_HIT_POINTS } from "../scoring";
import { generateRound } from "../generator";
import SignalWatchScreen from "../screen";
import type { SessionPersistence } from "../session";
import { GAME_ID } from "../types";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const PARAMS = PROSPECTIVE_CUE_DIFFICULTY_PARAMS.normal;
/** Per-item response window of a normal session's first round (ms). */
const ITEM_MS = PARAMS.initialItemMs;
/** Pacing granularity; mirrors the screen's WINDOW_TICK_MS. */
const TICK_MS = 50;

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, {
    completed: true,
    replayRequested: false,
    version: "1.0.0",
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

async function renderScreen(options: { seed?: string } = {}) {
  const clock = createFakeClock(0);
  const persister = makePersister();
  const result = await render(
    <SignalWatchScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={options.seed ?? "window-test-seed"}
      persistSession={persister}
    />,
  );
  return { clock, persister, result };
}

async function advanceTime(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

function progressLabel(): string {
  const node = screen.getByTestId(testId(GAME_ID, "progress"));
  return String(node.props.accessibilityLabel);
}

function scoreValue(): number {
  const node = screen.getByTestId(testId(GAME_ID, "score"));
  // SessionHeader renders `Score {score}`: an array like ["Score ", 15].
  const children = Array.isArray(node.props.children)
    ? node.props.children
    : [node.props.children];
  const numeric = [...children].reverse().find((c) => typeof c === "number");
  if (typeof numeric === "number") {
    return numeric;
  }
  // Fallback: trailing integer of the flattened text.
  const text = children.join("");
  const match = /(\d+)\s*$/.exec(text);
  return match === null ? Number.NaN : Number(match[1]);
}

/**
 * Points a quick (one-tick) correct response earns for an item, mirroring
 * the game's raw scoring rules.
 */
function quickPoints(isSignal: boolean): number {
  return isSignal ? SIGNAL_HIT_POINTS : GO_HIT_POINTS + GO_SPEED_BONUS;
}

describe("SignalWatchScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setLiveAudioHaptics(noopAudioHaptics);
  });
  afterEach(() => {
    jest.useRealTimers();
    setLiveAudioHaptics(noopAudioHaptics);
  });

  it("starts into the briefing and then streams items", async () => {
    await renderScreen({ seed: "smoke" });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    expect(screen.getByTestId(testId(GAME_ID, "briefing-start"))).toBeTruthy();
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "briefing-start")),
    );
    expect(screen.getByTestId(testId(GAME_ID, "stream-status"))).toBeTruthy();
    expect(progressLabel()).toBe(`Item 1 of ${PARAMS.streamLen}`);
  });

  it("pays the GO speed bonus from the elapsed fraction at press time", async () => {
    const seed = "speed-bonus-seed";
    // Reproduce the deterministic round-0 content for this seed/difficulty.
    const round = generateRound({
      rng: createRng(seed),
      roundIndex: 0,
      signalCount: PARAMS.initialSignalCount,
      streamLen: PARAMS.streamLen,
      prevActiveSignalIds: null,
    });
    const targetIdx = round.items.findIndex((item) => !item.isSignal);
    expect(targetIdx).toBeGreaterThanOrEqual(0);

    async function playToTargetWithPressDelay(pressDelayMs: number) {
      await renderScreen({ seed });
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, "briefing-start")),
      );
      // Answer everything before the target with a one-tick response, which
      // contributes identically in both runs: +120 per signal catch,
      // +GO base + full speed bonus per quick filler GO.
      for (let i = 0; i < targetIdx; i += 1) {
        await advanceTime(TICK_MS);
        await fireEvent.press(
          screen.getByTestId(
            testId(GAME_ID, round.items[i].isSignal ? "signal" : "go"),
          ),
        );
      }
      // Let the target filler's window drain partially, then GO.
      await advanceTime(pressDelayMs);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "go")));
      return scoreValue();
    }

    const slowScore = await playToTargetWithPressDelay(ITEM_MS / 2);
    const fastScore = await playToTargetWithPressDelay(TICK_MS);

    const prefixPoints = round.items
      .slice(0, targetIdx)
      .reduce((sum, item) => sum + quickPoints(item.isSignal), 0);
    // Half-drained window → half the speed bonus; one-tick window → full.
    const slowExpected =
      prefixPoints +
      GO_HIT_POINTS +
      Math.round(GO_SPEED_BONUS * (1 - (ITEM_MS / 2) / ITEM_MS));
    const fastExpected =
      prefixPoints +
      GO_HIT_POINTS +
      Math.round(GO_SPEED_BONUS * (1 - TICK_MS / ITEM_MS));

    expect(slowScore).toBe(slowExpected);
    expect(fastScore).toBe(fastExpected);
    expect(fastScore).toBeGreaterThan(slowScore);
  });

  it("freezes the response window while paused and resumes the remainder", async () => {
    await renderScreen({ seed: "freeze-resume-seed" });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "briefing-start")),
    );
    expect(progressLabel()).toBe(`Item 1 of ${PARAMS.streamLen}`);

    // Drain part of item 1's window, then pause.
    await advanceTime(1000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "pause")));
    expect(screen.getByTestId(testId(GAME_ID, "pause-overlay"))).toBeTruthy();

    // Frozen: far more background time than the whole window must not move
    // the stream forward. (The stream UI is accessibility-hidden while the
    // opaque overlay is up, so it is not queried here; the remaining-window
    // math below proves the freeze.)
    await advanceTime(5000);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "resume")));

    // Resume CONTINUES the remaining window: 1000ms was already consumed, so
    // all but one remaining tick keeps the item open…
    await advanceTime(ITEM_MS - 1000 - TICK_MS);
    expect(progressLabel()).toBe(`Item 1 of ${PARAMS.streamLen}`);
    // …and the tick that exhausts the remaining budget expires item 1.
    await advanceTime(TICK_MS);
    expect(progressLabel()).toBe(`Item 2 of ${PARAMS.streamLen}`);
  });

  it("resolves every timed-out item and lands on a failed round", async () => {
    const seed = "timeout-stream-seed";
    await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "briefing-start")),
    );

    // Let every item time out; each expiry must advance exactly one slot.
    for (let i = 0; i < PARAMS.streamLen - 1; i += 1) {
      await advanceTime(ITEM_MS + TICK_MS);
      expect(progressLabel()).toBe(`Item ${i + 2} of ${PARAMS.streamLen}`);
    }
    await advanceTime(ITEM_MS + TICK_MS);
    expect(screen.getByTestId(testId(GAME_ID, "round-failed"))).toBeTruthy();
  });
});
