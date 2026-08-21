/**
 * WordChainScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → question → round results → results → persistence.
 * Pause freeze semantics, the tutorial lifecycle, and the dev-only QA force
 * paths (win/lose/timeout) are covered too.
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
import { loadContentPack } from "../content-validation";
import { filterByLength, filterByTiers, generateRound } from "../generator";
import { WORD_CHAIN_DIFFICULTY_PARAMS } from "../difficulty";
import {
  FULL_CHAIN_BONUS,
  PER_STEP_BASE,
  PER_STEP_MAX_SPEED,
  perfectSessionScore,
} from "../scoring";
import WordChainScreen from "../screen";
import { seedToNumber } from "../session";
import type { SessionPersistence } from "../session";
import { CONTENT_PACK_ID, CONTENT_PACK_VERSION } from "../versions";
import { GAME_ID } from "../types";
import type {
  LanguageWordChainRawResult,
  WordChainRound,
} from "../types";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const PACK = loadContentPack();
const NORMAL_PARAMS = WORD_CHAIN_DIFFICULTY_PARAMS.normal;
const NORMAL_POOL = filterByLength(
  filterByTiers(PACK.chains, ["t1", "t2"]),
  NORMAL_PARAMS.minChainLen,
  NORMAL_PARAMS.maxChainLen,
);

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
    persister?: SessionPersistence & { completeSession: jest.Mock };
  } = {},
) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <WordChainScreen
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

/** Reproduce the reducer's deterministic round selection for a seed. */
function expectedRound(
  seed: string,
  roundIndex: number,
  used: ReadonlySet<string>,
  previous: WordChainRound | null,
): WordChainRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    pool: NORMAL_POOL,
    decoyPool: PACK.decoyPool,
    params: NORMAL_PARAMS,
    usedChainIds: used,
    previousRound: previous,
  });
}

describe("WordChainScreen", () => {
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

    expect(screen.getByTestId(testId(GAME_ID, "chain"))).toBeOnTheScreen();
    // The anchor word is revealed; later unknown positions are masked.
    expect(
      screen.getByTestId(testId(GAME_ID, "chain-word", "0")),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "round", "1")),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "time-budget")),
    ).toBeOnTheScreen();
    // expert shows five options per blank
    for (let i = 0; i < 5; i += 1) {
      expect(
        screen.getByTestId(testId(GAME_ID, "option", String(i))),
      ).toBeOnTheScreen();
    }
  });

  it("opens the tutorial on first play, completes it, and does not reopen it", async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: "tut", store });

    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-next")));

    const demo = generateRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      pool: filterByTiers(PACK.chains, ["t1"]),
      decoyPool: PACK.decoyPool,
      params: TUTORIAL_DEMO_PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    await fireEvent.press(
      screen.getByTestId(
        testId(GAME_ID, "option", String(demo.steps[0].correctIndex)),
      ),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-done")));

    expect(screen.queryByTestId(testId(GAME_ID, "tutorial"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    await result.unmount();
    await render(
      <WordChainScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, "tutorial"))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    // Replay on demand via the help button.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "help")));
    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
  });

  it("retries the demo after a wrong pick and offers the dev-only skip", async () => {
    await renderScreen({ seed: "skip", store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-next")));

    const demo = generateRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      pool: filterByTiers(PACK.chains, ["t1"]),
      decoyPool: PACK.decoyPool,
      params: TUTORIAL_DEMO_PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    const wrongIndex =
      demo.steps[0].correctIndex === 0
        ? 1
        : demo.steps[0].correctIndex - 1;
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "option", String(wrongIndex))),
    );
    expect(
      screen.getByTestId(testId(GAME_ID, "tutorial-retry")),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-retry")));
    // The retry re-draws a different deterministic demo chain.
    const retried = generateRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 1,
      pool: filterByTiers(PACK.chains, ["t1"]),
      decoyPool: PACK.decoyPool,
      params: TUTORIAL_DEMO_PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    });
    await fireEvent.press(
      screen.getByTestId(
        testId(GAME_ID, "option", String(retried.steps[0].correctIndex)),
      ),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-done")));
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();

    // Dev-only skip path on a fresh first-play store.
    await renderScreen({ seed: "skip-2", store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "tutorial-skip")));
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeOnTheScreen();
  });

  it("plays a full normal session end-to-end and persists the record", async () => {
    const seed = "screen-test-seed";
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));

    let previous: WordChainRound | null = null;
    const used = new Set<string>();
    for (let round = 0; round < NORMAL_PARAMS.rounds; round += 1) {
      const expected = expectedRound(seed, round, used, previous);
      used.add(expected.chainId);
      previous = expected;
      for (const step of expected.steps) {
        await fireEvent.press(
          screen.getByTestId(
            testId(GAME_ID, "option", String(step.correctIndex)),
          ),
        );
      }
      expect(
        screen.getByTestId(testId(GAME_ID, "round-correct")),
      ).toBeOnTheScreen();
      // Accrue a little active session time while BETWEEN chains (no step
      // clock is running in roundResult), so the recorded duration is
      // non-zero while every answer itself stays instant.
      await advanceTime(clock, 100);
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    }

    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "accuracy")),
    ).toHaveTextContent("100%");
    expect(
      screen.getByTestId(testId(GAME_ID, "rounds-correct")),
    ).toHaveTextContent("6/6");
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe("language-word-chain");
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThan(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as LanguageWordChainRawResult;
    // Natural perfect play: every step instant (base + max speed bonus) plus
    // one full-chain bonus per chain. Blank count is random within
    // [minBlanks, maxBlanks], so this can stay below the reference maximum.
    const expectedScore =
      raw.stepsPlayed * (PER_STEP_BASE + PER_STEP_MAX_SPEED) +
      NORMAL_PARAMS.rounds * FULL_CHAIN_BONUS;
    expect(raw.score).toBe(expectedScore);
    expect(expectedScore).toBeLessThanOrEqual(perfectSessionScore(NORMAL_PARAMS));
    expect(raw.forced).toBe(false);
    expect(raw.difficulty).toBe("normal");
    expect(raw.contentPackId).toBe(CONTENT_PACK_ID);
    expect(raw.contentPackVersion).toBe(CONTENT_PACK_VERSION);
    expect(raw.roundOutcomes).toHaveLength(NORMAL_PARAMS.rounds);
    expect(raw.diagnosticMetadata.gameVersion).toBe("1.0.0");
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: "normal", challengeRating: 0.5 }),
    );
  });

  it("fails a round on a wrong pick but continues to the next chain", async () => {
    const seed = "wrong-pick";
    await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));

    const expected = expectedRound(seed, 0, new Set(), null);
    const step = expected.steps[0];
    const wrongIndex = step.options.findIndex((_, i) => i !== step.correctIndex);
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "option", String(wrongIndex))),
    );

    expect(screen.getByTestId(testId(GAME_ID, "round-wrong"))).toBeOnTheScreen();
    // The full chain is revealed after the round (post-round feedback).
    const reveal = screen.getByTestId(testId(GAME_ID, "round-answer-reveal"));
    expect(reveal).toHaveTextContent(
      `The chain was ${expected.words.join(" → ")}`,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
  });

  it("expires a chain that outlives its budget", async () => {
    const { clock } = await renderScreen({ seed: "timeout" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await advanceTime(clock, NORMAL_PARAMS.timePerRoundMs + 500);

    expect(
      screen.getByTestId(testId(GAME_ID, "round-timeout")),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
  });

  it("pauses: opaque overlay appears and the budget freezes until resume", async () => {
    const { clock } = await renderScreen({ seed: "pause-test" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await advanceTime(clock, 500); // partway through the chain

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "pause")));
    expect(
      screen.getByTestId(`${GAME_ID}.pause-overlay`),
    ).toBeOnTheScreen();

    // The opaque pause contract: the challenge is hidden from the
    // accessibility tree while paused, so options are unqueryable.
    expect(
      screen.queryByTestId(testId(GAME_ID, "option", "0")),
    ).toBeNull();

    // Frozen: background time must not consume the chain budget.
    await advanceTime(clock, 20_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "resume")));
    expect(
      screen.queryByTestId(`${GAME_ID}.pause-overlay`),
    ).toBeNull();
    // Only the remaining active budget is left: 12000 - 500 elapsed.
    await advanceTime(clock, 11_000);
    expect(screen.queryByTestId(testId(GAME_ID, "round-timeout"))).toBeNull();
    await advanceTime(clock, 1_000);
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
    const raw = input.session.rawResult as LanguageWordChainRawResult;
    expect(raw.forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
    expect(raw.score).toBe(perfectSessionScore(NORMAL_PARAMS));
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
    expect((input.session.rawResult as LanguageWordChainRawResult).forced).toBe(
      true,
    );
    expect(input.session.normalizedResult).toBe(0);
  });

  it("force-timeout expires only the current chain and keeps playing", async () => {
    await renderScreen({ seed: "qa-timeout" });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-timeout")));

    expect(
      screen.getByTestId(testId(GAME_ID, "round-timeout")),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, "results"))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    expect(screen.getByTestId(testId(GAME_ID, "round", "2"))).toBeOnTheScreen();
  });

  it("surfaces persistence failures without crashing", async () => {
    const failing = {
      completeSession: jest.fn(async () => {
        throw new Error("db locked");
      }),
    } as unknown as SessionPersistence & { completeSession: jest.Mock };
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      await renderScreen({ seed: "persist-fail", persister: failing });

      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-win")));
      await act(async () => {});

      expect(
        screen.getByTestId(testId(GAME_ID, "persist-error")),
      ).toBeOnTheScreen();
      expect(failing.completeSession).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
