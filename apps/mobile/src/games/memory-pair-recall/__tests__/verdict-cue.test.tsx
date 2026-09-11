/**
 * Verdict-cue contract (campaign 025) for Pair Recall.
 *
 * Pair Recall answers one cue at a time and advances immediately, so the
 * screen replays the just-answered cue below the live one with the verdict
 * derived from the reducer's authoritative `lastCue` outcome. A wrong pick
 * shows the ✕ cue AND the true partner's ✓ cue together in one frame; a
 * correct pick shows ✓ alone; untouched options stay neutral. The prompt stays
 * mounted while the verdict shows. Scores animate through `AnimatedNumber`
 * (`score-live` in session, `score-final` in results).
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from "@/sdk";
import type { CompleteSessionInput } from "@/db";

import { PAIR_RECALL_DIFFICULTY_PARAMS } from "../difficulty";
import { generateRound } from "../generator";
import { stimulusById } from "../pairs";
import PairRecallScreen from "../screen";
import type { SessionPersistence } from "../session";
import { GAME_ID } from "../types";
import type { PairRecallRound } from "../types";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const PARAMS = PAIR_RECALL_DIFFICULTY_PARAMS.normal;
const STUDY_MS = PARAMS.studyMs;

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

async function renderScreen(options: { seed?: string } = {}) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  const result = await render(
    <PairRecallScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? "verdict-cue"}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the study timers (act is async). */
async function advanceTime(
  clock: ReturnType<typeof createFakeClock>,
  ms: number,
) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** The deterministic round-0 content the reducer generates for a seed. */
function firstRound(seed: string): PairRecallRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex: 0,
    pairCount: PARAMS.initialPairCount,
    prevRound: null,
  });
}

/** Start a session and let the study window elapse into cued recall. */
async function startAndOpenRecall(seed: string) {
  const rendered = await renderScreen({ seed });
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
  await advanceTime(rendered.clock, STUDY_MS);
  expect(screen.getByTestId(testId(GAME_ID, "recall-status"))).toBeOnTheScreen();
  return { ...rendered, round: firstRound(seed) };
}

describe("PairRecallScreen verdict cues", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("a correct response replays the cue with a ✓ cue and leaves untouched options neutral", async () => {
    const seed = "verdict-correct";
    const { round } = await startAndOpenRecall(seed);
    const pair = round.pairs[round.cueOrder[0]];

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "response", String(pair.responseId))),
    );

    expect(screen.getByTestId(testId(GAME_ID, "cue-feedback"))).toBeOnTheScreen();
    const picked = screen.getByTestId(
      testId(GAME_ID, "feedback-response", String(pair.responseId)),
    );
    expect(
      within(picked).getByText("✓", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(picked.props.accessibilityLabel).toMatch(/Correct/);
    expect(
      within(picked).queryByText("✕", { includeHiddenElements: true }),
    ).toBeNull();

    for (const responseId of round.responseOptions) {
      if (responseId === pair.responseId) continue;
      const idle = screen.getByTestId(
        testId(GAME_ID, "feedback-response", String(responseId)),
      );
      expect(
        within(idle).queryByText("✓", { includeHiddenElements: true }),
      ).toBeNull();
      expect(
        within(idle).queryByText("✕", { includeHiddenElements: true }),
      ).toBeNull();
      expect(idle.props.accessibilityLabel).not.toMatch(/Correct|Wrong pick/);
    }
  });

  it("a wrong pick shows the ✕ cue and the true partner's ✓ cue in the same frame", async () => {
    const seed = "verdict-wrong";
    const { round } = await startAndOpenRecall(seed);
    const pair = round.pairs[round.cueOrder[0]];
    const wrongResponse = round.responseOptions.find(
      (id) => id !== pair.responseId,
    )!;

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "response", String(wrongResponse))),
    );

    const wrongOption = screen.getByTestId(
      testId(GAME_ID, "feedback-response", String(wrongResponse)),
    );
    const correctOption = screen.getByTestId(
      testId(GAME_ID, "feedback-response", String(pair.responseId)),
    );

    // Wrong cue on the tapped option …
    expect(
      within(wrongOption).getByText("✕", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(wrongOption.props.accessibilityLabel).toMatch(/Wrong pick/);
    // … correct cue alongside it on the true partner …
    expect(
      within(correctOption).getByText("✓", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(correctOption.props.accessibilityLabel).toMatch(/Correct/);
    // … and the wrong pick never reads as correct.
    expect(
      within(wrongOption).queryByText("✓", { includeHiddenElements: true }),
    ).toBeNull();
    expect(wrongOption.props.accessibilityLabel).not.toMatch(/Correct/);

    // Untouched options stay neutral — no verdict glyph, no verdict name.
    for (const responseId of round.responseOptions) {
      if (responseId === wrongResponse || responseId === pair.responseId) continue;
      const idle = screen.getByTestId(
        testId(GAME_ID, "feedback-response", String(responseId)),
      );
      expect(
        within(idle).queryByText("✓", { includeHiddenElements: true }),
      ).toBeNull();
      expect(
        within(idle).queryByText("✕", { includeHiddenElements: true }),
      ).toBeNull();
      expect(idle.props.accessibilityLabel).not.toMatch(/Correct|Wrong pick/);
    }
  });

  it("keeps the prompt mounted while the verdict shows", async () => {
    const seed = "verdict-prompt";
    const { round } = await startAndOpenRecall(seed);
    const pair = round.pairs[round.cueOrder[0]];
    const stimulus = stimulusById(pair.stimulusId);
    const wrongResponse = round.responseOptions.find(
      (id) => id !== pair.responseId,
    )!;

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, "response", String(wrongResponse))),
    );

    // The live cue's prompt is still rendered …
    expect(screen.getByTestId(testId(GAME_ID, "recall-status"))).toBeOnTheScreen();
    // … and the replayed cue keeps the prompt the verdict belongs to.
    const feedback = screen.getByTestId(testId(GAME_ID, "cue-feedback"));
    expect(within(feedback).getByText(stimulus.glyph)).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "feedback-cue"))).toBeOnTheScreen();
  });

  it("animates the score live in session and in results", async () => {
    const seed = "verdict-score";
    const { clock } = await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
    // Live count-up readout beside the HUD score, visible from the first phase.
    expect(screen.getByTestId(testId(GAME_ID, "score-live"))).toBeOnTheScreen();

    await advanceTime(clock, STUDY_MS);
    const round = firstRound(seed);
    for (const pairIndex of round.cueOrder) {
      await fireEvent.press(
        screen.getByTestId(
          testId(GAME_ID, "response", String(round.pairs[pairIndex].responseId)),
        ),
      );
    }
    expect(screen.getByTestId(testId(GAME_ID, "round-passed"))).toBeOnTheScreen();
    // Still mounted behind the round verdict so the gain reads as movement.
    expect(screen.getByTestId(testId(GAME_ID, "score-live"))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-win")));
    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "score-final"))).toBeOnTheScreen();
    // The plain StatRow score survives next to the animated readout.
    expect(screen.getByTestId(testId(GAME_ID, "score"))).toBeOnTheScreen();
  });
});
