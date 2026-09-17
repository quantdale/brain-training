import { describe, expect, it } from "@jest/globals";

import type { GameSessionRecord } from "@/db";

import {
  buildNextConsideration,
  buildProgressConsistency,
  buildProgressMovement,
  type DomainInsight,
  type TrainingBalance,
} from "@/analytics";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function session(
  completedAt: number,
  normalizedResult: number,
): GameSessionRecord {
  return { completedAt, normalizedResult } as GameSessionRecord;
}

function balance(overrides: Partial<TrainingBalance> = {}): TrainingBalance {
  return {
    windowSessions: 2,
    mappedSessions: 2,
    unmappedSessions: 0,
    perDomain: [
      { domain: "Memory", sessions: 2, share: 1 },
      { domain: "Attention", sessions: 0, share: 0 },
    ],
    trainedDomains: 1,
    untrainedDomains: ["Attention"],
    topDomain: "Memory",
    topDomainShare: 1,
    ...overrides,
  };
}

function insight(
  domain: string,
  status: DomainInsight["status"],
  daysSinceUpdate: number | null,
): DomainInsight {
  return {
    domain,
    status,
    rating: status === "unseen" ? null : 1000,
    sessions: status === "unseen" ? 0 : 2,
    updatedAt: daysSinceUpdate === null ? null : NOW - daysSinceUpdate * DAY,
    daysSinceUpdate,
    windowMovement: 0,
    direction: "flat",
    windowEntries: 0,
    windowSeries: [],
    bestRating: status === "unseen" ? null : 1000,
    bestRatingAt: status === "unseen" ? null : NOW,
  };
}

describe("Progress disclosure summaries", () => {
  it("counts sessions and distinct days in the selected window, including all-time", () => {
    const sessions = [
      session(NOW, 0.8),
      session(NOW - 2 * DAY, 0.7),
      session(NOW - 40 * DAY, 0.6),
    ];

    expect(buildProgressConsistency(sessions, NOW, "30d")).toEqual({
      sessions: 2,
      activeDays: 2,
      averagePerActiveDay: 1,
    });
    expect(buildProgressConsistency(sessions, NOW, "all")).toEqual({
      sessions: 3,
      activeDays: 3,
      averagePerActiveDay: 1,
    });
  });

  it("distinguishes no evidence and one-session insufficient movement", () => {
    expect(buildProgressMovement([], NOW, "30d")).toMatchObject({
      status: "empty",
      comparison: "none",
      delta: null,
    });
    expect(
      buildProgressMovement([session(NOW - DAY, 0.8)], NOW, "30d"),
    ).toMatchObject({
      status: "insufficient",
      sampleSize: 1,
      average: 0.8,
      delta: null,
    });
  });

  it("compares a bounded-window average to lifetime and all-time first to latest", () => {
    const sessions = [
      session(NOW - 40 * DAY, 0.5),
      session(NOW - 3 * DAY, 0.8),
      session(NOW - DAY, 0.9),
    ];
    expect(buildProgressMovement(sessions, NOW, "30d")).toMatchObject({
      status: "observed",
      sampleSize: 2,
      comparison: "window-average",
      delta: expect.closeTo(0.1166666667, 8),
      direction: "up",
    });
    expect(buildProgressMovement(sessions, NOW, "all")).toMatchObject({
      status: "observed",
      sampleSize: 3,
      comparison: "first-to-latest",
      delta: expect.closeTo(0.4, 8),
      direction: "up",
    });
  });

  it("prioritizes an untrained domain, then stale, then least practiced", () => {
    expect(
      buildNextConsideration(
        [insight("Memory", "fresh", 1), insight("Attention", "unseen", null)],
        balance(),
      ),
    ).toMatchObject({ domain: "Attention", reason: "not-trained" });

    expect(
      buildNextConsideration(
        [insight("Memory", "fresh", 1), insight("Attention", "stale", 40)],
        balance({
          untrainedDomains: [],
          perDomain: [
            { domain: "Memory", sessions: 2, share: 1 },
            { domain: "Attention", sessions: 0, share: 0 },
          ],
        }),
      ),
    ).toMatchObject({ domain: "Attention", reason: "not-recent" });

    expect(
      buildNextConsideration(
        [insight("Memory", "fresh", 1), insight("Attention", "fresh", 1)],
        balance({
          untrainedDomains: [],
          perDomain: [
            { domain: "Memory", sessions: 2, share: 0.667 },
            { domain: "Attention", sessions: 1, share: 0.333 },
          ],
        }),
      ),
    ).toMatchObject({
      domain: "Attention",
      reason: "least-practiced",
      sessionsInWindow: 1,
    });
  });
});
