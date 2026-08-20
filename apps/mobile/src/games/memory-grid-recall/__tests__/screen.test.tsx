/**
 * GridRecallScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → study → input → submit → rounds → results →
 * persistence. Pause freeze semantics and the dev-only QA force paths are
 * covered too.
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

import { TUTORIAL_DEMO_SEED } from "../components/tutorial";
import { generateTargetCells } from "../generator";
import GridRecallScreen from "../screen";
import { seedToNumber } from "../session";
import type { SessionPersistence } from "../session";
import { GAME_ID } from "../types";
import type { GridRecallRawResult } from "../types";
import { perfectSessionScore, referenceMaxTargets } from "../scoring";
import { GRID_RECALL_DIFFICULTY_PARAMS } from "../difficulty";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const STUDY_MS = 1800;

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
    <GridRecallScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? "screen-test-seed"}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

async function advanceTime(
  clock: ReturnType<typeof createFakeClock>,
  ms: number,
) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

describe("GridRecallScreen", () => {
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

    expect(
      screen.getByTestId(testId(GAME_ID, "study-board")),
    ).toBeOnTheScreen();
    // expert grid is 6×6 = 36 cells; cell 35 exists, 36 does not.
    expect(screen.getByTestId(testId(GAME_ID, "cell", "35"))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, "cell", "36"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "round", "1"))).toBeOnTheScreen();
  });

  it("opens the tutorial on first play, completes it, and does not reopen it", async () => {
    const store = createInMemoryTutorialStore();
    const clock = createFakeClock(0);
    const { result } = await renderScreen({ seed: "tut", store, clock });

    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-next")));

    const demo = generateTargetCells({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      gridSize: 9,
      targetCount: 2,
      prevTargets: null,
    });
    await advanceTime(clock, 1500); // study window ends
    for (const cell of demo) {
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, "cell", String(cell))),
      );
    }
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "tutorial-demo-done")),
    );

    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    await result.unmount();
    await render(
      <GridRecallScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, "tutorial"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "help")));
    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
  });

  it("skips the tutorial via the dev-only QA button", async () => {
    await renderScreen({ seed: "skip", store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-skip")));
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();
  });

  it("plays a full normal session end-to-end and persists the record", async () => {
    const seed = "screen-test-seed";
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));

    let prev: number[] | null = null;
    let targetCount = 5;
    for (let round = 0; round < 5; round += 1) {
      // study phase → input phase
      await advanceTime(clock, STUDY_MS);
      expect(
        screen.getByTestId(testId(GAME_ID, "input-board")),
      ).toBeOnTheScreen();

      const targets = generateTargetCells({
        rng: createRng(seed),
        roundIndex: round,
        gridSize: 16,
        targetCount,
        prevTargets: prev,
      });
      for (const cell of targets) {
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, "cell", String(cell))),
        );
      }
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "submit")));

      if (round < 4) {
        expect(
          screen.getByTestId(testId(GAME_ID, "round-passed")),
        ).toBeOnTheScreen();
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, "next-round")),
        );
      }
      prev = targets;
      targetCount += 1;
    }

    expect(
      screen.getByTestId(testId(GAME_ID, "round-passed")),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "rounds-passed")),
    ).toHaveTextContent("5/5");
    expect(
      screen.getByTestId(testId(GAME_ID, "best-recall")),
    ).toHaveTextContent(
      String(referenceMaxTargets(GRID_RECALL_DIFFICULTY_PARAMS.normal)),
    );

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe("memory-grid-recall");
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThan(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as GridRecallRawResult;
    expect(raw.score).toBe(
      perfectSessionScore(GRID_RECALL_DIFFICULTY_PARAMS.normal),
    );
    expect(raw.diagnosticMetadata.gameVersion).toBe("1.0.0");
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe("normal");
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: "normal", challengeRating: 0.5 }),
    );
  });

  it("fails a round on a wrong tap but continues with partial credit", async () => {
    const seed = "wrong-tap";
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await advanceTime(clock, STUDY_MS);

    expect(
      screen.getByTestId(testId(GAME_ID, "input-board")),
    ).toBeOnTheScreen();
    const targets = generateTargetCells({
      rng: createRng(seed),
      roundIndex: 0,
      gridSize: 16,
      targetCount: 5,
      prevTargets: null,
    });
    const targetSet = new Set(targets);
    const wrongCell = Array.from({ length: 16 }, (_, i) => i).find(
      (i) => !targetSet.has(i),
    )!;
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "cell", String(wrongCell))),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "submit")));

    expect(
      screen.getByTestId(testId(GAME_ID, "round-failed")),
    ).toBeOnTheScreen();
    // round-result board shows the solution (post-round feedback), not during obscuring.
    expect(
      screen.getByTestId(testId(GAME_ID, "round-result-board")),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "score"))).toHaveTextContent(
      "Score 0",
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
    await advanceTime(clock, STUDY_MS); // length still 5
    expect(
      screen.getByTestId(testId(GAME_ID, "input-board")),
    ).toBeOnTheScreen();
  });

  it("pauses: the opaque overlay appears and timers freeze until resume", async () => {
    const { clock } = await renderScreen({ seed: "pause-test" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await advanceTime(clock, 500); // partway through study

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "pause")));
    expect(
      screen.getByTestId("memory-grid-recall.pause-overlay"),
    ).toBeOnTheScreen();

    // Frozen: background time must not advance the study window.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "resume")));
    expect(screen.queryByTestId(testId(GAME_ID, "input-board"))).toBeNull();

    // The full remaining study window is still required.
    await advanceTime(clock, STUDY_MS - 500);
    expect(screen.queryByTestId(testId(GAME_ID, "input-board"))).toBeNull();
    await advanceTime(clock, 1);
    expect(
      screen.getByTestId(testId(GAME_ID, "input-board")),
    ).toBeOnTheScreen();
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
    expect((input.session.rawResult as GridRecallRawResult).forced).toBe(true);
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
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as GridRecallRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
