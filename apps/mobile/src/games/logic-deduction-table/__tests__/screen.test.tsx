/**
 * LogicDeductionScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → question → answer → rounds → results → persistence.
 * Pause freeze semantics, the per-round timeout, the tutorial flow, and the
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
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  testId,
} from "@/sdk";
import type { CompleteSessionInput } from "@/db";

import { TUTORIAL_DEMO_PARAMS, TUTORIAL_DEMO_SEED } from "../components/tutorial";
import { LOGIC_DEDUCTION_DIFFICULTY_PARAMS } from "../difficulty";
import { generateRound } from "../generator";
import LogicDeductionScreen from "../screen";
import { perfectSessionScore } from "../scoring";
import { seedToNumber } from "../session";
import type { SessionPersistence } from "../session";
import { GAME_ID } from "../types";
import type { LogicDeductionRawResult, LogicDeductionRound } from "../types";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = LOGIC_DEDUCTION_DIFFICULTY_PARAMS.normal;

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
    <LogicDeductionScreen
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

/** The round the reducer must show for `(seed, roundIndex)` under `params`. */
function expectedRound(
  seed: string,
  roundIndex: number,
  params:
    | typeof NORMAL
    | typeof TUTORIAL_DEMO_PARAMS = NORMAL,
  prev: LogicDeductionRound | null = null,
): LogicDeductionRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    params,
    prevRound: prev,
  });
}

describe("LogicDeductionScreen", () => {
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

    expect(screen.getByTestId(testId(GAME_ID, "round", "1"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "clue-table"))).toBeOnTheScreen();
    // expert table has 5 entity rows (A..E); F does not exist.
    expect(screen.getByTestId(testId(GAME_ID, "entity", "A"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "entity", "E"))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, "entity", "F"))).toBeNull();
    const round = expectedRound("intro", 0, LOGIC_DEDUCTION_DIFFICULTY_PARAMS.expert);
    expect(round.entityCount).toBe(5);
    expect(
      screen.getAllByTestId(testId(GAME_ID, "question")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId(testId(GAME_ID, "question"))).toHaveTextContent(
      round.question.text,
    );
    expect(
      screen.getByTestId(testId(GAME_ID, "time-budget")),
    ).toHaveTextContent("Answer within 18s");
    // Every attribute domain has 5 values → exactly 5 option cards.
    for (let i = 0; i < 5; i += 1) {
      expect(
        screen.getByTestId(testId(GAME_ID, "option", String(i))),
      ).toBeOnTheScreen();
    }
    expect(
      screen.queryByTestId(testId(GAME_ID, "option", "5")),
    ).toBeNull();
  });

  it("opens the tutorial on first play, completes it, and does not reopen it", async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: "tut", store });

    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-next")));

    const demo = expectedRound(TUTORIAL_DEMO_SEED, 0, TUTORIAL_DEMO_PARAMS);
    expect(demo.entityCount).toBe(3);
    expect(
      screen.getByTestId(testId(GAME_ID, "tutorial-question")),
    ).toHaveTextContent(demo.question.text);

    // A wrong pick reveals the retry affordance; the correct pick finishes.
    const wrongIndex = demo.options.findIndex(
      (_, i) => i !== demo.correctIndex,
    );
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "option", String(wrongIndex))),
    );
    expect(
      screen.getByTestId(testId(GAME_ID, "tutorial-retry")),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-retry")));
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "option", String(demo.correctIndex))),
    );
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "tutorial-done")),
    );

    expect(screen.queryByTestId(testId(GAME_ID, "tutorial"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    await result.unmount();
    await render(
      <LogicDeductionScreen
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

    let prev: LogicDeductionRound | null = null;
    for (let round = 0; round < NORMAL.rounds; round += 1) {
      const expected = generateRound({
        rng: createRng(seed),
        roundIndex: round,
        params: NORMAL,
        prevRound: prev,
      });
      expect(
        screen.getByTestId(testId(GAME_ID, "round", String(round + 1))),
      ).toBeOnTheScreen();
      expect(screen.getByTestId(testId(GAME_ID, "question"))).toHaveTextContent(
        expected.question.text,
      );
      // Answer instantly (answerMs 0) so the run is perfect.
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, "option", String(expected.correctIndex))),
      );
      expect(
        screen.getByTestId(testId(GAME_ID, "round-correct")),
      ).toBeOnTheScreen();
      if (round < NORMAL.rounds - 1) {
        // Dead time while the lifecycle keeps running (durationMs > 0).
        await advanceTime(clock, 100);
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, "next-round")),
        );
      }
      prev = expected;
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "rounds-correct")),
    ).toHaveTextContent("6/6");
    expect(screen.getByTestId(testId(GAME_ID, "accuracy"))).toHaveTextContent(
      "100%",
    );
    expect(
      screen.getByTestId(testId(GAME_ID, "best-streak")),
    ).toHaveTextContent("6");
    expect(screen.queryByTestId(testId(GAME_ID, "forced-badge"))).toBeNull();

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe("logic-deduction-table");
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThan(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as LogicDeductionRawResult;
    expect(raw.score).toBe(perfectSessionScore(NORMAL));
    expect(raw.diagnosticMetadata.gameVersion).toBe("1.1.0");
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe("normal");
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: "normal", challengeRating: 0.5 }),
    );
  });

  it("fails a round on a wrong pick, reveals the answer, and continues", async () => {
    const seed = "wrong-pick";
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    const first = generateRound({
      rng: createRng(seed),
      roundIndex: 0,
      params: NORMAL,
      prevRound: null,
    });
    const wrongIndex = first.options.findIndex(
      (_, i) => i !== first.correctIndex,
    );
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "option", String(wrongIndex))),
    );

    expect(screen.getByTestId(testId(GAME_ID, "round-wrong"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "round-answer-reveal")),
    ).toHaveTextContent(`The answer was ${first.answer}`);
    // Only the player's own (wrong) card reads as selected.
    expect(
      screen.getByTestId(testId(GAME_ID, "option", String(wrongIndex)))
        .props.accessibilityState,
    ).toEqual({ disabled: true, selected: true });
    expect(
      screen.getByTestId(testId(GAME_ID, "option", String(first.correctIndex)))
        .props.accessibilityState,
    ).toEqual({ disabled: true, selected: false });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
    const second = generateRound({
      rng: createRng(seed),
      roundIndex: 1,
      params: NORMAL,
      prevRound: first,
    });
    expect(screen.getByTestId(testId(GAME_ID, "question"))).toHaveTextContent(
      second.question.text,
    );
    void clock;
  });

  it("expires a round at the deadline and records a timeout", async () => {
    const seed = "timeout";
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    const first = generateRound({
      rng: createRng(seed),
      roundIndex: 0,
      params: NORMAL,
      prevRound: null,
    });
    await advanceTime(clock, NORMAL.roundTimeMs);

    expect(
      screen.getByTestId(testId(GAME_ID, "round-timeout")),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "round-answer-reveal")),
    ).toHaveTextContent(`The answer was ${first.answer}`);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
  });

  it("pauses: the opaque overlay appears and the deadline freezes until resume", async () => {
    const { clock } = await renderScreen({ seed: "pause-test" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await advanceTime(clock, 1000); // partway through the round

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "pause")));
    expect(
      screen.getByTestId(`${GAME_ID}.pause-overlay`),
    ).toBeOnTheScreen();

    // Frozen: background time must not consume the round budget.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "resume")));
    expect(screen.queryByTestId(testId(GAME_ID, "round-timeout"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "question"))).toBeOnTheScreen();

    // Remaining budget was 26000 - 1000 = 25000, rebased onto the resume time.
    await advanceTime(clock, 24_000);
    expect(screen.queryByTestId(testId(GAME_ID, "round-timeout"))).toBeNull();
    await advanceTime(clock, 2000);
    expect(
      screen.getByTestId(testId(GAME_ID, "round-timeout")),
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
    expect((input.session.rawResult as LogicDeductionRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it("force-lose ends the session as a failed run", async () => {
    const { persister } = await renderScreen({ seed: "qa-lose" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-lose")));

    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "forced-badge")),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "rounds-correct")),
    ).toHaveTextContent("0/1");
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as LogicDeductionRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it("force-timeout expires only the current round via the QA panel", async () => {
    await renderScreen({ seed: "qa-timeout" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-timeout")));

    expect(
      screen.getByTestId(testId(GAME_ID, "round-timeout")),
    ).toBeOnTheScreen();
    // The session itself is not marked forced by a per-round force.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
  });
});
