/**
 * PairRecallScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with fake
 * timers: intro → study → recall (cued responses) → rounds → results →
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
  noopAudioHaptics,
  setLiveAudioHaptics,
  testId,
} from "@/sdk";
import type { CompleteSessionInput } from "@/db";

import { PAIR_RECALL_DIFFICULTY_PARAMS } from "../difficulty";
import { generateRound } from "../generator";
import PairRecallScreen from "../screen";
import type { SessionPersistence } from "../session";
import { GAME_ID } from "../types";
import type { PairRecallRound } from "../types";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const STUDY_MS = PAIR_RECALL_DIFFICULTY_PARAMS.normal.studyMs;

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
    <PairRecallScreen
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

/** Reproduce the deterministic whole-session round content for a seed. */
function sessionRounds(seed: string): PairRecallRound[] {
  const rng = createRng(seed);
  const params = PAIR_RECALL_DIFFICULTY_PARAMS.normal;
  const rounds: PairRecallRound[] = [];
  let prev: PairRecallRound | null = null;
  let count = params.initialPairCount;
  for (let r = 0; r < params.rounds; r += 1) {
    const round = generateRound({
      rng,
      roundIndex: r,
      pairCount: count,
      prevRound: prev,
    });
    rounds.push(round);
    prev = round;
    count = Math.min(params.maxPairCount, count + 1);
  }
  return rounds;
}

describe("PairRecallScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    setLiveAudioHaptics(noopAudioHaptics);
  });

  it("renders the intro with difficulty options and starts a session", async () => {
    await renderScreen({ seed: "intro" });
    expect(screen.getByTestId(testId(GAME_ID, "intro"))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, "start"))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, "help"))).toBeTruthy();
    for (const level of ["easy", "normal", "hard", "expert", "adaptive"]) {
      expect(
        screen.getByTestId(testId(GAME_ID, "difficulty", level)),
      ).toBeTruthy();
    }

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "difficulty", "expert")),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));

    expect(screen.getByTestId(testId(GAME_ID, "study-status"))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, "pair-board"))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, "round", "1"))).toBeTruthy();
  });

  it("plays a full round: study → cued recall → round passed", async () => {
    const seed = "full-round-seed";
    const { clock } = await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));

    // Study window elapses → recall phase.
    await advanceTime(clock, STUDY_MS);
    expect(screen.getByTestId(testId(GAME_ID, "recall-status"))).toBeTruthy();

    // Answer every cue correctly using the deterministic round content.
    const round = sessionRounds(seed)[0];
    for (let cue = 0; cue < round.cueOrder.length; cue += 1) {
      const pairIndex = round.cueOrder[cue];
      await fireEvent.press(
        screen.getByTestId(
          testId(GAME_ID, "response", String(round.pairs[pairIndex].responseId)),
        ),
      );
    }
    expect(screen.getByTestId(testId(GAME_ID, "round-passed"))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, "next-round"))).toBeTruthy();
  });

  it("a wrong pick plays wrong feedback and fails the round", async () => {
    const feedbackEvents: string[] = [];
    setLiveAudioHaptics({
      ...noopAudioHaptics,
      feedback: (event) => feedbackEvents.push(event),
    });
    const seed = "wrong-pick-seed";
    const { clock } = await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await advanceTime(clock, STUDY_MS);

    const round = sessionRounds(seed)[0];
    const firstPair = round.pairs[round.cueOrder[0]];
    const wrongResponse = round.responseOptions.find(
      (id) => id !== firstPair.responseId,
    )!;
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "response", String(wrongResponse))),
    );
    expect(feedbackEvents).toContain("wrong");

    // Finish the remaining cues correctly; the round still fails.
    for (let cue = 1; cue < round.cueOrder.length; cue += 1) {
      const pairIndex = round.cueOrder[cue];
      await fireEvent.press(
        screen.getByTestId(
          testId(GAME_ID, "response", String(round.pairs[pairIndex].responseId)),
        ),
      );
    }
    expect(screen.getByTestId(testId(GAME_ID, "round-failed"))).toBeTruthy();
  });

  it("drives a full session to results and persists once", async () => {
    const seed = "session-seed";
    const persister = makePersister();
    const { clock } = await renderScreen({ seed, persister });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));

    const rounds = sessionRounds(seed);
    for (const round of rounds) {
      await advanceTime(clock, STUDY_MS); // study → recall
      for (let cue = 0; cue < round.cueOrder.length; cue += 1) {
        const pairIndex = round.cueOrder[cue];
        await fireEvent.press(
          screen.getByTestId(
            testId(
              GAME_ID,
              "response",
              String(round.pairs[pairIndex].responseId),
            ),
          ),
        );
      }
      expect(screen.getByTestId(testId(GAME_ID, "round-passed"))).toBeTruthy();
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, "next-round")));
    }

    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeTruthy();
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe(GAME_ID);
    expect((input.session.rawResult as { forced: boolean }).forced).toBe(false);
  });

  it("pauses: the opaque overlay appears and the study window freezes until resume", async () => {
    const { clock } = await renderScreen({ seed: "pause-test" });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await advanceTime(clock, 500); // partway through study

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "pause")));
    expect(screen.getByTestId(testId(GAME_ID, "pause-overlay"))).toBeTruthy();

    // Frozen: background time must not advance the study window. After resume
    // the FULL remaining window (2800 − 500 = 2300ms) is still required.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "resume")));
    expect(screen.queryByTestId(testId(GAME_ID, "recall-status"))).toBeNull();

    await advanceTime(clock, 2000); // less than the remaining window
    expect(screen.queryByTestId(testId(GAME_ID, "recall-status"))).toBeNull();
    await advanceTime(clock, 400);
    expect(screen.getByTestId(testId(GAME_ID, "recall-status"))).toBeTruthy();
  });

  it("force-win ends the session as a perfect run and marks it forced", async () => {
    const { persister } = await renderScreen({ seed: "qa-win" });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-win")));

    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, "forced-badge"))).toBeTruthy();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as { forced: boolean }).forced).toBe(true);
  });

  it("opens the tutorial on demand", async () => {
    await renderScreen({ seed: "tutorial" });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "help")));
    expect(screen.getByTestId(testId(GAME_ID, "tutorial"))).toBeTruthy();
  });

  it("the screen's deterministic content matches the module generator", () => {
    const seed = "screen-test-seed";
    const direct = generateRound({
      rng: createRng(seed),
      roundIndex: 0,
      pairCount: PAIR_RECALL_DIFFICULTY_PARAMS.normal.initialPairCount,
      prevRound: null,
    });
    expect(sessionRounds(seed)[0]).toEqual(direct);
  });
});
