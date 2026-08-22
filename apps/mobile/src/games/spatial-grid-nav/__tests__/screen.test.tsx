/**
 * SpatialGridNavScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop:
 * intro → tutorial → trials → results → persistence. Pause semantics and the
 * dev-only QA force paths are covered too.
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
import { createFakeClock, createInMemoryTutorialStore, testId } from "@/sdk";
import type { CompleteSessionInput } from "@/db";

import { generateSession } from "../generator";
import {
  DIFFICULTY_PARAMS,
  paramsFromProfile,
  resolveSpatialGridNavDifficulty,
} from "../difficulty";
import SpatialGridNavScreen from "../screen";
import { seedToNumber } from "../session";
import type { SessionPersistence } from "../session";
import { GAME_ID } from "../types";
import type { SpatialGridNavRawResult } from "../types";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

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
    rating: null,
    completionOutcome: null,
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
    <SpatialGridNavScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? "screen-test-seed"}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

describe("SpatialGridNavScreen", () => {
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

    expect(screen.getByTestId(testId(GAME_ID, "grid"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "command-list")),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "options-grid")),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "round", "1"))).toBeOnTheScreen();
  });

  it("opens the tutorial on first play and can be skipped (dev)", async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: "tut", store });

    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-next")));
    expect(
      screen.getByTestId(testId(GAME_ID, "tutorial-board")),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "tutorial-commands")),
    ).toBeOnTheScreen();

    // Dev build exposes the skip button which completes the tutorial.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-skip")));
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    await result.unmount();
    await render(
      <SpatialGridNavScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, "tutorial"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();
  });

  it("plays a full normal session end-to-end and persists the record", async () => {
    const seed = "screen-test-seed";
    const { persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    expect(screen.getByTestId(testId(GAME_ID, "grid"))).toBeOnTheScreen();

    const params = paramsFromProfile(resolveSpatialGridNavDifficulty("normal"));
    const plan = generateSession(seed, params);
    const rounds = DIFFICULTY_PARAMS.normal.rounds;

    for (let round = 0; round < rounds; round += 1) {
      expect(
        screen.getByTestId(testId(GAME_ID, "options-grid")),
      ).toBeOnTheScreen();
      const correctIndex = plan[round].correctIndex;
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, "option", String(correctIndex))),
      );
      if (round < rounds - 1) {
        expect(
          screen.getByTestId(testId(GAME_ID, "round-correct")),
        ).toBeOnTheScreen();
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, "next-round")),
        );
      }
    }

    expect(
      screen.getByTestId(testId(GAME_ID, "round-correct")),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "accuracy"))).toHaveTextContent(
      "100%",
    );

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe("spatial-grid-nav");
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBeGreaterThan(0);
    expect(input.session.normalizedResult).toBeLessThanOrEqual(1);
    const raw = input.session.rawResult as SpatialGridNavRawResult;
    expect(raw.score).toBe(DIFFICULTY_PARAMS.normal.rounds * 150);
    expect(raw.correctPicks).toBe(DIFFICULTY_PARAMS.normal.rounds);
    expect(raw.diagnosticMetadata.gameVersion).toBe("1.0.0");
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe("normal");
    expect(raw.forced).toBe(false);
  });

  it("fails a round on a wrong tap and continues", async () => {
    const seed = "wrong-tap";
    await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    expect(
      screen.getByTestId(testId(GAME_ID, "options-grid")),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "option", "0")));

    const passed = screen.queryByTestId(testId(GAME_ID, "round-correct"));
    const failed = screen.queryByTestId(testId(GAME_ID, "round-wrong"));
    expect(passed !== null || failed !== null).toBe(true);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
  });

  it("pauses: the overlay appears, blocks picks, and resumes", async () => {
    await renderScreen({ seed: "pause-test" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    expect(screen.getByTestId(testId(GAME_ID, "grid"))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "pause")));
    expect(
      screen.getByTestId(testId(GAME_ID, "pause-title")),
    ).toBeOnTheScreen();

    // Options are UNMOUNTED while paused (campaign 011 device fix: deep
    // option-board nests inside accessibility buttons made the overlay
    // subtree vanish from the Android a11y tree, leaving Resume/Quit
    // unreachable — see the screen.tsx paused-gating note). The opaque
    // overlay covers them, so no pick can happen and nothing leaks through.
    expect(screen.queryByTestId(testId(GAME_ID, "option", "0"))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, "round-result"))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "resume")));
    expect(screen.getByTestId(testId(GAME_ID, "grid"))).toBeOnTheScreen();
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
    expect((input.session.rawResult as SpatialGridNavRawResult).forced).toBe(
      true,
    );
    expect(input.session.normalizedResult).toBeGreaterThanOrEqual(0.8);
    expect(input.session.normalizedResult).toBeLessThanOrEqual(1);
  });

  it("force-lose ends the session as a failed run", async () => {
    const { persister } = await renderScreen({ seed: "qa-lose" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-lose")));

    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "accuracy"))).toHaveTextContent(
      "0%",
    );
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SpatialGridNavRawResult).forced).toBe(
      true,
    );
    expect(input.session.normalizedResult).toBe(0);
  });
});
