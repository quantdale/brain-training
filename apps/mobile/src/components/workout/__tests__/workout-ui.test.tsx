/**
 * Workout V2 home-surface component contracts (campaign 012 / W07).
 *
 * Covers the pieces W08 will drive on-device through stable testIDs:
 * length/template chip selection (+ resume-aware "2 of 4 done"/Completed
 * markers), the selected-template detail panel, the focus-workout
 * explanation, the extended completion card (avg % + per-game outcomes),
 * and length-labelled history rows. All components are purely
 * presentational — every fixture is built by hand, no db/clock/registry.
 */
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import {
  WorkoutCompletionCard,
  WorkoutFocusExplanation,
  WorkoutHistoryRow,
  WorkoutLengthChips,
  WorkoutTemplateChips,
  WorkoutTemplateDetails,
} from "@/components/workout";
import type { WorkoutSelectionReason } from "@/workout/personalize";
import type {
  WorkoutCompletionSummary,
  WorkoutGameOutcome,
} from "@/workout/summary";
import type { WorkoutLength } from "@/workout/metadata";
import type { WorkoutTemplate } from "@/workout/templates";

/** Flatten a rendered element's React children into plain text. */
function textOf(element: { props: { children?: unknown } }): string {
  const walk = (value: unknown): string => {
    if (value == null || typeof value === "boolean") return "";
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) return value.map(walk).join("");
    return "";
  };
  return walk(element.props.children);
}

const MEMORY_FOCUS: WorkoutTemplate = {
  id: "focus-memory",
  name: "Memory Focus",
  description: "A targeted workout training Memory games.",
  kind: "template",
  focus: "Memory",
  lengths: ["short", "standard", "extended"],
};

const NOW_MS = 1_787_391_306_144;

function makeSummary(
  overrides: Partial<WorkoutCompletionSummary> = {},
): WorkoutCompletionSummary {
  return {
    key: "2026-08-22",
    date: "2026-08-22",
    status: "completed",
    metadata: null,
    totalGames: 2,
    completedGames: 2,
    completionRatio: 1,
    totalXp: 90,
    avgNormalized: 0.86,
    totalDurationMs: 105_000,
    finishedAt: NOW_MS - 60_000,
    outcomes: [],
    reasons: null,
    ...overrides,
  };
}

function makeOutcome(overrides: Partial<WorkoutGameOutcome> = {}): WorkoutGameOutcome {
  return {
    gameId: "memory-match",
    position: 0,
    played: true,
    session: {
      gameId: "memory-match",
      normalizedResult: 0.92,
      xp: 50,
      durationMs: 60_000,
      completedAt: NOW_MS - 60_000,
    },
    ...overrides,
  };
}

describe("WorkoutLengthChips", () => {
  it("renders one selectable chip per length with game counts", async () => {
    const { getByTestId } = await render(
      <WorkoutLengthChips
        selected="standard"
        onSelect={() => undefined}
        testIDPrefix="home-workout-length"
      />,
    );

    expect(getByTestId("home-workout-length-short")).toBeTruthy();
    expect(getByTestId("home-workout-length-standard")).toBeTruthy();
    expect(getByTestId("home-workout-length-extended")).toBeTruthy();
    // Selected state is exposed for screen readers / automation.
    expect(
      getByTestId("home-workout-length-standard").props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(
      getByTestId("home-workout-length-short").props.accessibilityState,
    ).toMatchObject({ selected: false });
    // Labels announce the variant + its game count (short/standard/extended
    // distinction is legible without seeing the screen).
    expect(
      getByTestId("home-workout-length-extended").props.accessibilityLabel,
    ).toBe("Extended workout, 6 games");
  });

  it("reports taps through onSelect", async () => {
    let picked: WorkoutLength | null = null;
    const { getByTestId } = await render(
      <WorkoutLengthChips
        selected="standard"
        onSelect={(length) => {
          picked = length;
        }}
        testIDPrefix="t"
      />,
    );
    fireEvent.press(getByTestId("t-short"));
    expect(picked).toBe("short");
  });
});

describe("WorkoutTemplateChips resume markers", () => {
  it("marks started templates with durable progress or completed state", async () => {
    const { getByTestId } = await render(
      <WorkoutTemplateChips
        templates={[MEMORY_FOCUS]}
        selectedId="focus-memory"
        startedIds={new Set(["focus-memory"])}
        resumeById={
          new Map([
            [
              "focus-memory",
              { completedGames: 2, totalGames: 4, status: "active" as const },
            ],
          ])
        }
        onSelect={() => {}}
        testIDPrefix="home-workout-template"
      />,
    );

    const chip = getByTestId("home-workout-template-focus-memory");
    expect(chip.props.accessibilityLabel).toBe(
      "Memory Focus · 2 of 4 done",
    );
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
  });

  it("falls back to Started / Completed markers", async () => {
    const { getByTestId, rerender } = await render(
      <WorkoutTemplateChips
        templates={[MEMORY_FOCUS]}
        selectedId={null}
        startedIds={new Set(["focus-memory"])}
        onSelect={() => {}}
        testIDPrefix="t"
      />,
    );
    expect(getByTestId("t-focus-memory").props.accessibilityLabel).toBe(
      "Memory Focus · Started",
    );

    await rerender(
      <WorkoutTemplateChips
        templates={[MEMORY_FOCUS]}
        selectedId={null}
        startedIds={new Set(["focus-memory"])}
        resumeById={
          new Map([
            [
              "focus-memory",
              { completedGames: 3, totalGames: 3, status: "completed" as const },
            ],
          ])
        }
        onSelect={() => {}}
        testIDPrefix="t"
      />,
    );
    expect(getByTestId("t-focus-memory").props.accessibilityLabel).toBe(
      "Memory Focus · Completed",
    );
  });
});

describe("WorkoutTemplateDetails", () => {
  it("shows the explicit length line and description for a fresh pick", async () => {
    const { getByTestId, queryByTestId } = await render(
      <WorkoutTemplateDetails
        template={MEMORY_FOCUS}
        lengthSpec={{ id: "standard", gameCount: 4, label: "Standard" }}
        resume={null}
        testID="home-workout-selected"
      />,
    );

    expect(getByTestId("home-workout-selected-heading").props.accessibilityLabel).toBe(
      "Memory Focus, Standard workout, 4 games",
    );
    expect(queryByTestId("home-workout-selected-resume")).toBeNull();
    expect(queryByTestId("home-workout-selected-done")).toBeNull();
  });

  it("surfaces the resumable position (2 of 4 done)", async () => {
    const { getByText, getByTestId } = await render(
      <WorkoutTemplateDetails
        template={MEMORY_FOCUS}
        lengthSpec={{ id: "standard", gameCount: 4, label: "Standard" }}
        resume={{ completedGames: 2, totalGames: 4, status: "active" }}
        testID="sel"
      />,
    );
    expect(getByTestId("sel-resume")).toBeTruthy();
    expect(getByText(/In progress — 2 of 4 done/)).toBeTruthy();
  });

  it("hides the resume block before the first game and shows completed state", async () => {
    const zero = await render(
      <WorkoutTemplateDetails
        template={MEMORY_FOCUS}
        lengthSpec={{ id: "short", gameCount: 2, label: "Short" }}
        resume={{ completedGames: 0, totalGames: 2, status: "active" }}
        testID="zero"
      />,
    );
    expect(zero.queryByTestId("zero-resume")).toBeNull();

    const done = await render(
      <WorkoutTemplateDetails
        template={MEMORY_FOCUS}
        lengthSpec={{ id: "short", gameCount: 2, label: "Short" }}
        resume={{ completedGames: 2, totalGames: 2, status: "completed" }}
        testID="done"
      />,
    );
    expect(done.getByTestId("done-done")).toBeTruthy();
  });
});

describe("WorkoutFocusExplanation", () => {
  it("summarizes personalization reasons into human lines", async () => {
    const reasons: WorkoutSelectionReason[] = [
      { gameId: "a", kind: "weak-domain", detail: "weak Memory domain" },
      { gameId: "b", kind: "weak-domain", detail: "weak Logic domain" },
      { gameId: "c", kind: "stale-domain", detail: "rusty Attention domain" },
      { gameId: "d", kind: "recency-avoided", detail: "recently played" },
    ];
    const { getByText, getByTestId } = await render(
      <WorkoutFocusExplanation
        template={MEMORY_FOCUS}
        reasons={reasons}
        testID="home-workout-focus"
      />,
    );
    expect(getByTestId("home-workout-focus-reasons")).toBeTruthy();
    expect(getByText("Why Memory focus?")).toBeTruthy();
    expect(getByText("· 2 games target your weaker domains first.")).toBeTruthy();
    expect(
      getByText("· 1 game revisits skills you haven't trained lately."),
    ).toBeTruthy();
    expect(getByText("· Recently played games move later in the order.")).toBeTruthy();
  });

  it("degrades to static copy when reasons are unavailable", async () => {
    const { queryByTestId } = await render(
      <WorkoutFocusExplanation
        template={MEMORY_FOCUS}
        reasons={null}
        testID="f"
      />,
    );
    expect(queryByTestId("f-reasons")).toBeNull();
  });
});

describe("WorkoutCompletionCard extension", () => {
  it("lists per-game outcomes with resolved names and results", async () => {
    const summary = makeSummary({
      outcomes: [
        makeOutcome(),
        makeOutcome({
          gameId: "unknown-game",
          position: 1,
          session: {
            gameId: "unknown-game",
            normalizedResult: 0.5,
            xp: 40,
            durationMs: 45_000,
            completedAt: NOW_MS - 30_000,
          },
        }),
      ],
    });
    const { getByTestId } = await render(
      <WorkoutCompletionCard
        summary={summary}
        resolveGameName={(id) => (id === "memory-match" ? "Memory Match" : null)}
        testID="card"
      />,
    );

    expect(getByTestId("card-outcomes")).toBeTruthy();
    expect(getByTestId("card-outcome-memory-match")).toBeTruthy();
    expect(textOf(getByTestId("card-outcome-result-memory-match"))).toBe(
      "92% · +50 XP",
    );
    // Unknown ids degrade to their raw id instead of disappearing.
    expect(getByTestId("card-outcome-unknown-game")).toBeTruthy();
    // Band carries the average performance.
    expect(textOf(getByTestId("card-band"))).toContain("86% avg");
  });

  it("omits the outcome feed when no resolver is injected", async () => {
    const { queryByTestId } = await render(
      <WorkoutCompletionCard summary={makeSummary()} testID="plain" />,
    );
    expect(queryByTestId("plain-outcomes")).toBeNull();
  });
});

describe("WorkoutHistoryRow readability", () => {
  it("suffixes template rows with their length variant", async () => {
    const { getByTestId } = await render(
      <WorkoutHistoryRow
        summary={makeSummary({ key: "2026-08-22::focus-memory::short" })}
        nowMs={NOW_MS}
        testID="hist-t"
      />,
    );
    expect(getByTestId("hist-t-name").props.children).toBe(
      "Memory Focus · Short",
    );
  });

  it("keeps daily rows unsuffixed and marks in-progress workouts", async () => {
    const { getByTestId } = await render(
      <WorkoutHistoryRow
        summary={makeSummary({
          status: "active",
          completedGames: 1,
          completionRatio: 0.5,
          avgNormalized: null,
        })}
        nowMs={NOW_MS}
        testID="hist-d"
      />,
    );
    expect(getByTestId("hist-d-name").props.children).toBe("Today's Workout");
    expect(textOf(getByTestId("hist-d-detail"))).toContain("In progress");
  });
});
