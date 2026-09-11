/**
 * Verdict-cue contract (PATTERNS-PLAY 6) for Cue Keeper.
 *
 * The reducer resolves an item and advances to the next one in the SAME
 * transition, so the verdict is presented on a dedicated banner derived from
 * the reducer's authoritative `lastItem` outcome — never from the tap. The
 * resolved prompt stays mounted while the verdict shows, a wrong pick is shown
 * together with the correct response in one frame, the untouched option stays
 * neutral, and the live GO/SIGNAL controls stay neutral because they already
 * belong to the next item. Scores animate through `AnimatedNumber`
 * (`score-live` in session, `score-final` in results beside the plain row).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
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
import { generateRound } from "../generator";
import { glyphById } from "../glyphs";
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

/** The round-0 content the reducer generates for a seed (normal difficulty). */
function expectedRound(seed: string) {
  return generateRound({
    rng: createRng(seed),
    roundIndex: 0,
    signalCount: PARAMS.initialSignalCount,
    streamLen: PARAMS.streamLen,
    prevActiveSignalIds: null,
  });
}

async function advanceTime(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** Render, start a session and enter round 0's stream. */
async function enterStream(seed: string) {
  await render(
    <SignalWatchScreen
      clock={createFakeClock(0)}
      tutorialStore={completedStore()}
      sessionSeed={seed}
      persistSession={makePersister()}
    />,
  );
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, "start")));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, "briefing-start")));
}

/** Flatten a (possibly press-state function) style to its resolved object. */
function flatStyle(element: { props: { style?: unknown } }) {
  const { style } = element.props;
  const resolved = typeof style === "function" ? style({ pressed: false }) : style;
  return StyleSheet.flatten(resolved);
}

/** The live controls must never carry the resolved item's verdict wording. */
function expectNeutralControl(id: string) {
  const control = screen.getByTestId(id);
  expect(String(control.props.accessibilityLabel)).not.toMatch(
    /Correct|Wrong pick|Timed out/,
  );
}

describe("SignalWatchScreen verdict cues", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setLiveAudioHaptics(noopAudioHaptics);
  });
  afterEach(() => {
    jest.useRealTimers();
    setLiveAudioHaptics(noopAudioHaptics);
  });

  it("shows a correct verdict with the resolved prompt while the untouched option stays neutral", async () => {
    const seed = "verdict-correct-seed";
    const item = expectedRound(seed).items[0];
    const correctChoice = item.isSignal ? "signal" : "go";
    const otherChoice = item.isSignal ? "go" : "signal";

    await enterStream(seed);
    await advanceTime(TICK_MS);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, correctChoice)));

    // The verdict is in words on the banner (never colour alone).
    const banner = screen.getByTestId(testId(GAME_ID, "verdict"));
    expect(String(banner.props.accessibilityLabel)).toMatch(/^Correct\./);
    expect(screen.getByTestId(testId(GAME_ID, "verdict-correct"))).toHaveTextContent(
      "Correct",
    );

    // The tapped (correct) option wears the ✓ cue and the success name.
    const correctChip = screen.getByTestId(
      testId(GAME_ID, "verdict-option", correctChoice),
    );
    expect(
      within(correctChip).getByText("✓", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      within(correctChip).queryByText("✕", { includeHiddenElements: true }),
    ).toBeNull();
    expect(String(correctChip.props.accessibilityLabel)).toMatch(/^Correct:/);

    // The untouched option stays neutral: no glyph, no verdict wording.
    const neutralChip = screen.getByTestId(
      testId(GAME_ID, "verdict-option", otherChoice),
    );
    expect(
      within(neutralChip).queryByText("✓", { includeHiddenElements: true }),
    ).toBeNull();
    expect(
      within(neutralChip).queryByText("✕", { includeHiddenElements: true }),
    ).toBeNull();
    expect(neutralChip.props.accessibilityLabel).toBe(
      otherChoice === "go" ? "GO" : "SIGNAL",
    );
    expect(flatStyle(neutralChip).backgroundColor).not.toBe(
      flatStyle(correctChip).backgroundColor,
    );

    // The prompt the player answered stays mounted while feedback shows.
    expect(screen.getByTestId(testId(GAME_ID, "stream-item"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "verdict-prompt"))).toHaveTextContent(
      glyphById(item.glyphId).glyph,
    );

    // The live controls already belong to the next item — no stale verdict.
    expectNeutralControl(testId(GAME_ID, "go"));
    expectNeutralControl(testId(GAME_ID, "signal"));
  });

  it("shows the wrong pick together with the correct response in one frame", async () => {
    const seed = "verdict-wrong-seed";
    const item = expectedRound(seed).items[0];
    const wrongChoice = item.isSignal ? "go" : "signal";
    const correctChoice = item.isSignal ? "signal" : "go";

    await enterStream(seed);
    await advanceTime(TICK_MS);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, wrongChoice)));

    const banner = screen.getByTestId(testId(GAME_ID, "verdict"));
    expect(String(banner.props.accessibilityLabel)).toMatch(/^Wrong pick\./);
    expect(screen.getByTestId(testId(GAME_ID, "verdict-wrong"))).toHaveTextContent(
      "Wrong pick",
    );

    const wrongChip = screen.getByTestId(
      testId(GAME_ID, "verdict-option", wrongChoice),
    );
    const correctChip = screen.getByTestId(
      testId(GAME_ID, "verdict-option", correctChoice),
    );

    // Wrong cue on the tapped option …
    expect(
      within(wrongChip).getByText("✕", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      within(wrongChip).queryByText("✓", { includeHiddenElements: true }),
    ).toBeNull();
    expect(String(wrongChip.props.accessibilityLabel)).toMatch(/^Wrong pick:/);
    // … correct cue alongside it on the response that was required …
    expect(
      within(correctChip).getByText("✓", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      within(correctChip).queryByText("✕", { includeHiddenElements: true }),
    ).toBeNull();
    expect(String(correctChip.props.accessibilityLabel)).toMatch(/^Correct:/);

    // Distinct fills + verdict boundaries back the glyphs.
    expect(flatStyle(wrongChip).backgroundColor).not.toBe(
      flatStyle(correctChip).backgroundColor,
    );
    expect(flatStyle(wrongChip).borderWidth).toBeGreaterThan(1.5);
    expect(flatStyle(correctChip).borderWidth).toBeGreaterThan(1.5);

    // The prompt stays visible with the verdict.
    expect(screen.getByTestId(testId(GAME_ID, "stream-item"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "verdict-prompt"))).toHaveTextContent(
      glyphById(item.glyphId).glyph,
    );

    // The live controls stay neutral for the next item.
    expectNeutralControl(testId(GAME_ID, "go"));
    expectNeutralControl(testId(GAME_ID, "signal"));
  });

  it("shows the omission verdict with only the correct response revealed", async () => {
    const seed = "verdict-timeout-seed";
    const item = expectedRound(seed).items[0];
    const correctChoice = item.isSignal ? "signal" : "go";

    await enterStream(seed);
    await advanceTime(ITEM_MS + TICK_MS);

    const banner = screen.getByTestId(testId(GAME_ID, "verdict"));
    expect(String(banner.props.accessibilityLabel)).toMatch(/^Timed out\./);
    expect(screen.getByTestId(testId(GAME_ID, "verdict-timeout"))).toHaveTextContent(
      "Timed out",
    );

    const correctChip = screen.getByTestId(
      testId(GAME_ID, "verdict-option", correctChoice),
    );
    expect(
      within(correctChip).getByText("✓", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(String(correctChip.props.accessibilityLabel)).toMatch(/^Correct:/);

    // An omission has no wrong pick: no ✕ anywhere on the banner.
    expect(
      within(banner).queryByText("✕", { includeHiddenElements: true }),
    ).toBeNull();

    // The prompt stays visible; the live controls stay neutral.
    expect(screen.getByTestId(testId(GAME_ID, "stream-item"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "verdict-prompt"))).toHaveTextContent(
      glyphById(item.glyphId).glyph,
    );
    expectNeutralControl(testId(GAME_ID, "go"));
    expectNeutralControl(testId(GAME_ID, "signal"));
  });

  it("animates the live score, reports HUD round progress and lands a final score", async () => {
    await enterStream("verdict-score-seed");

    // Live count-up readout visible during play.
    expect(screen.getByTestId(testId(GAME_ID, "score-live"))).toBeOnTheScreen();

    // The bounded session reports real position to the shared HUD.
    const progress = screen.getByTestId("session-progress");
    expect(String(progress.props.accessibilityLabel)).toBe(
      `1 of ${PARAMS.rounds} rounds complete`,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "qa-toggle")));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, "force-win")));
    await act(async () => {});

    expect(screen.getByTestId(testId(GAME_ID, "results"))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, "score-final"))).toBeOnTheScreen();
    // The plain StatRow score survives beside the animated readout.
    expect(screen.getByTestId(testId(GAME_ID, "score"))).toBeOnTheScreen();
  });
});
