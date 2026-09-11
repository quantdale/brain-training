/**
 * DeductionTable verdict-language tests.
 *
 * The shared verdict vocabulary on the option board and the round-result
 * panel: correct/wrong/timeout map onto fill + glyph + accessible wording,
 * the stem stays mounted while feedback shows, and the score reads out
 * through the animated counter.
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
import type { FakeClock } from "@/sdk";
import type { CompleteSessionInput } from "@/db";

import { LOGIC_DEDUCTION_DIFFICULTY_PARAMS } from "../difficulty";
import { generateRound } from "../generator";
import LogicDeductionScreen from "../screen";
import type { SessionPersistence } from "../session";
import { GAME_ID } from "../types";

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

async function renderScreen(seed: string) {
  const clock = createFakeClock(0);
  await render(
    <LogicDeductionScreen
      clock={clock}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  return { clock };
}

async function advanceTime(clock: FakeClock, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

function firstRound(seed: string) {
  return generateRound({
    rng: createRng(seed),
    roundIndex: 0,
    params: NORMAL,
    prevRound: null,
  });
}

describe("LogicDeductionScreen verdict language", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("marks the true answer correct (fill + glyph + words) on a hit", async () => {
    const seed = "verdict-correct";
    await renderScreen(seed);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    const first = firstRound(seed);

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "option", String(first.correctIndex))),
    );

    const panel = screen.getByTestId(testId(GAME_ID, "round-verdict"));
    expect(panel).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "round-correct"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "round-verdict-glyph"), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent("✓");
    // The verdict is in the accessible name, not colour alone.
    expect(
      screen.getByLabelText(`Correct: ${first.options[first.correctIndex]}`),
    ).toBeOnTheScreen();
    // The stem stays mounted while feedback shows.
    expect(screen.getByTestId(testId(GAME_ID, "clue-table"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "question"))).toHaveTextContent(
      first.question.text,
    );
  });

  it("marks the wrong pick alongside the correct answer on a miss", async () => {
    const seed = "verdict-wrong";
    await renderScreen(seed);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    const first = firstRound(seed);
    const wrongIndex = first.options.findIndex((_, i) => i !== first.correctIndex);

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "option", String(wrongIndex))),
    );

    const panel = screen.getByTestId(testId(GAME_ID, "round-verdict"));
    expect(panel).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "round-wrong"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "round-verdict-glyph"), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent("✕");
    expect(
      screen.getByLabelText(`Wrong pick: ${first.options[wrongIndex]}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`Correct: ${first.options[first.correctIndex]}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "round-answer-reveal")),
    ).toHaveTextContent(`The answer was ${first.answer}`);
    // Untouched options read as locked.
    const mutedIndex = first.options.findIndex(
      (_, i) => i !== first.correctIndex && i !== wrongIndex,
    );
    expect(
      screen.getByLabelText(`${first.options[mutedIndex]}, locked`),
    ).toBeOnTheScreen();
  });

  it("uses the timeout verdict when the deadline wins", async () => {
    const seed = "verdict-timeout";
    const { clock } = await renderScreen(seed);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    const first = firstRound(seed);

    await advanceTime(clock, NORMAL.roundTimeMs);

    const panel = screen.getByTestId(testId(GAME_ID, "round-verdict"));
    expect(panel).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "round-timeout"))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, "round-verdict-glyph"), {
        includeHiddenElements: true,
      }),
    ).toHaveTextContent("⏱");
    // The answer is still revealed and marked correct.
    expect(
      screen.getByLabelText(`Correct: ${first.options[first.correctIndex]}`),
    ).toBeOnTheScreen();
  });

  it("shows the animated live score while the session runs", async () => {
    await renderScreen("verdict-score");
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    const live = screen.getByTestId(testId(GAME_ID, "score-live"));
    expect(live).toBeOnTheScreen();
    expect(live).toHaveTextContent("0");
  });
});
