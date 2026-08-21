/**
 * RunningOrderScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → reveal (paced flashes) → input → submit → rounds →
 * results → persistence. Pause freeze semantics, the interactive tutorial
 * demo and the dev-only QA force paths are covered too.
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
  testId,
} from "@/sdk";
import type { CompleteSessionInput } from "@/db";

import {
  TUTORIAL_DEMO_RECALL,
  TUTORIAL_DEMO_STREAM,
} from "../components/tutorial";
import { RUNNING_ORDER_DIFFICULTY_PARAMS } from "../difficulty";
import { generateStream, streamTarget } from "../generator";
import RunningOrderScreen from "../screen";
import { seedToNumber } from "../session";
import type { SessionPersistence } from "../session";
import { SYMBOL_COUNT } from "../symbols";
import { GAME_ID } from "../types";
import type { RunningOrderRawResult } from "../types";
import { perfectSessionScore, referenceMaxTargets } from "../scoring";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = RUNNING_ORDER_DIFFICULTY_PARAMS.normal;
const FLASH_MS = NORMAL.flashMs; // 800ms per revealed symbol
const STREAM_LEN = NORMAL.streamLen; // 4 symbols per stream
const ROUNDS = NORMAL.rounds; // 5 rounds

/** Mirror of the reducer's deterministic stream generation for a round. */
function expectedStream(
  seed: string,
  roundIndex: number,
  streamLen: number,
  recallLength: number,
  prevTarget: readonly number[] | null,
): number[] {
  return generateStream({
    rng: createRng(seed),
    roundIndex,
    streamLen,
    recallLength,
    prevTarget,
  });
}

/** Tutorial store that already completed the tutorial (skips first-play). */
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
    <RunningOrderScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? "screen-test-seed"}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/**
 * Advance both the fake lifecycle clock and the flash pacing timer (RNTL act is async).
 *
 * The reveal chain re-schedules its next timeout only after React flushes the
 * previous tick, so each call fires at most one flash — advance one symbol at
 * a time (see `revealStream`).
 */
async function advanceTime(
  clock: ReturnType<typeof createFakeClock>,
  ms: number,
) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Play out a full reveal: one paced flash per symbol. */
async function revealStream(
  clock: ReturnType<typeof createFakeClock>,
  symbols = STREAM_LEN,
) {
  for (let i = 0; i < symbols; i += 1) {
    await advanceTime(clock, FLASH_MS);
  }
}

describe("RunningOrderScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the intro with difficulty options and starts a session", async () => {
    await renderScreen({ seed: "intro" });
    expect(screen.getByTestId(testId(GAME_ID, "intro"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "help"))).toBeOnTheScreen();
    for (const level of ["easy", "normal", "hard", "expert", "adaptive"]) {
      expect(
        screen.getByTestId(testId(GAME_ID, "difficulty", level)),
      ).toBeOnTheScreen();
    }

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "difficulty", "expert")),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));

    // Expert: 8-symbol stream flashing one at a time.
    expect(screen.getByTestId(testId(GAME_ID, "reveal"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "reveal-symbol")),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "round", "1"))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, "input"))).toBeNull();
  });

  it("opens the tutorial on first play, runs the demo, and does not reopen it", async () => {
    const store = createInMemoryTutorialStore();
    const clock = createFakeClock(0);
    const { result } = await renderScreen({ seed: "tut", store, clock });

    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-next")));

    // Demo flashes a fixed 3-symbol stream, one symbol every 800ms; each
    // flash is scheduled only after the previous tick's re-render settles.
    for (let i = 0; i < TUTORIAL_DEMO_STREAM.length; i += 1) {
      await advanceTime(clock, 800);
    }
    expect(
      screen.getByTestId(testId(GAME_ID, "tutorial-demo-status")),
    ).toHaveTextContent(`Tap the last ${TUTORIAL_DEMO_RECALL} in order`);

    const demoTarget = TUTORIAL_DEMO_STREAM.slice(
      TUTORIAL_DEMO_STREAM.length - TUTORIAL_DEMO_RECALL,
    );
    // A wrong final pick clears the input and asks to retry.
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "tutorial-palette", "0")),
    );
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "tutorial-palette", "1")),
    );
    expect(
      screen.getByTestId(testId(GAME_ID, "tutorial-demo-feedback")),
    ).toHaveTextContent("Not quite — watch again and try the last two in order.");

    // Correct ordered recall of the last two completes the demo.
    for (const id of demoTarget) {
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, "tutorial-palette", String(id))),
      );
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-done")));
    expect(screen.queryByTestId(testId(GAME_ID, "tutorial"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(
      <RunningOrderScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, "tutorial"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    // The help button requests a replay.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "help")));
    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
  });

  it("skips the tutorial via the dev-only QA button", async () => {
    await renderScreen({ seed: "skip", store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-skip")));
    expect(screen.queryByTestId(testId(GAME_ID, "tutorial"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();
  });

  it("plays a full normal session end-to-end and persists the record", async () => {
    const seed = "screen-test-seed";
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));

    let prevTarget: readonly number[] | null = null;
    let recallLength = NORMAL.initialRecallLength;
    for (let round = 0; round < ROUNDS; round += 1) {
      // Reveal paces one symbol per flashMs until the input phase opens.
      await revealStream(clock);
      expect(screen.getByTestId(testId(GAME_ID, "input"))).toBeOnTheScreen();

      const stream = expectedStream(
        seed,
        round,
        STREAM_LEN,
        recallLength,
        prevTarget,
      );
      const target = stream.slice(STREAM_LEN - recallLength);
      for (const id of target) {
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, "palette", String(id))),
        );
      }
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "submit")));

      if (round < ROUNDS - 1) {
        expect(
          screen.getByTestId(testId(GAME_ID, "round-passed")),
        ).toBeOnTheScreen();
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, "next-round")),
        );
      }
      prevTarget = target;
      recallLength = Math.min(STREAM_LEN, recallLength + 1);
    }

    expect(screen.getByTestId(testId(GAME_ID, "round-passed"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "rounds-passed")),
    ).toHaveTextContent("5/5");
    expect(screen.getByTestId(testId(GAME_ID, "accuracy"))).toHaveTextContent(
      "100%",
    );
    expect(
      screen.getByTestId(testId(GAME_ID, "best-recall")),
    ).toHaveTextContent(String(referenceMaxTargets(NORMAL)));
    expect(screen.getByTestId(testId(GAME_ID, "score"))).toHaveTextContent(
      String(perfectSessionScore(NORMAL)),
    );

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe("memory-running-order");
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThan(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as RunningOrderRawResult;
    expect(raw.score).toBe(perfectSessionScore(NORMAL));
    expect(raw.diagnosticMetadata.gameVersion).toBe("1.0.0");
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe("normal");
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: "normal", challengeRating: 0.5 }),
    );
  });

  it("fails a round on a wrong order but continues without escalation", async () => {
    const seed = "wrong-order";
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await revealStream(clock);

    expect(screen.getByTestId(testId(GAME_ID, "input"))).toBeOnTheScreen();
    const target = streamTarget(
      expectedStream(seed, 0, STREAM_LEN, NORMAL.initialRecallLength, null),
      NORMAL.initialRecallLength,
    );
    // Enter a shifted sequence: every position is wrong by construction.
    for (const id of target) {
      await fireEvent.press(
        screen.getByTestId(
          testId(GAME_ID, "palette", String((id + 1) % SYMBOL_COUNT)),
        ),
      );
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "submit")));

    expect(screen.getByTestId(testId(GAME_ID, "round-failed"))).toBeOnTheScreen();
    // The round-result feedback shows the correct trailing target.
    expect(
      screen.getByTestId(testId(GAME_ID, "result-target", "0")),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
    await revealStream(clock); // recall length held at 3
    expect(
      screen.getByTestId(testId(GAME_ID, "input-status")),
    ).toHaveTextContent("Recall the last 3 in order");
  });

  it("pauses: the opaque overlay appears and timers freeze until resume", async () => {
    const { clock } = await renderScreen({ seed: "pause-test" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await advanceTime(clock, FLASH_MS); // partway through the reveal

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "pause")));
    expect(
      screen.getByTestId(`${GAME_ID}.pause-overlay`),
    ).toBeOnTheScreen();

    // Frozen: background time must not advance the reveal pacing.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "resume")));
    expect(screen.queryByTestId(testId(GAME_ID, "input"))).toBeNull();

    // The remaining flashes are still required (3 ticks left after resume),
    // one per advance: each tick is scheduled only after the previous settles.
    await advanceTime(clock, FLASH_MS);
    expect(screen.queryByTestId(testId(GAME_ID, "input"))).toBeNull();
    await advanceTime(clock, FLASH_MS);
    expect(screen.queryByTestId(testId(GAME_ID, "input"))).toBeNull();
    await advanceTime(clock, FLASH_MS);
    expect(screen.getByTestId(testId(GAME_ID, "input"))).toBeOnTheScreen();
  });

  it("force-win ends the session as a perfect run and marks it forced", async () => {
    const { persister } = await renderScreen({ seed: "qa-win" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-win")));

    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "forced-badge")),
    ).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as RunningOrderRawResult).forced).toBe(
      true,
    );
    expect(input.session.normalizedResult).toBe(1);
  });

  it("force-lose ends the session as a failed run", async () => {
    const { persister } = await renderScreen({ seed: "qa-lose" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-lose")));

    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "rounds-passed")),
    ).toHaveTextContent("0/1");
    expect(screen.getByTestId(testId(GAME_ID, "accuracy"))).toHaveTextContent(
      "0%",
    );
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as RunningOrderRawResult).forced).toBe(
      true,
    );
    expect(input.session.normalizedResult).toBe(0);
  });
});
