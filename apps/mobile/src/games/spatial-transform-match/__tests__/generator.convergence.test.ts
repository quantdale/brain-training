// Convergence sweeps for Transform Match — 8.1-8.9
// All production profiles x many seeds, final validator on every return/fallback,
// exact option count, hidden-source unambiguity, no symmetry bypass.

import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import { ADAPTIVE_PARAMS, DIFFICULTY_PARAMS } from "../difficulty";
import {
  MIN_PATTERN_DISTANCE,
  OUTER_GENERATION_ATTEMPTS,
  applyTransform,
  generateRoundData,
  isSymmetric,
  patternDistance,
  validateGeneratedRound,
} from "../generator";
import type { TransformType } from "../types";
import type { RoundData } from "../generator";

type Profile = {
  name: string;
  gridSize: number;
  side: number;
  filledCells: number;
  allowed: TransformType[];
  optionCount: number;
};

const PRODUCTION_PROFILES: Profile[] = [
  {
    name: "easy",
    gridSize: DIFFICULTY_PARAMS.easy.gridSize,
    side: Math.round(Math.sqrt(DIFFICULTY_PARAMS.easy.gridSize)),
    filledCells: DIFFICULTY_PARAMS.easy.filledCells,
    allowed: [...DIFFICULTY_PARAMS.easy.allowedTransforms],
    optionCount: DIFFICULTY_PARAMS.easy.optionCount,
  },
  {
    name: "normal",
    gridSize: DIFFICULTY_PARAMS.normal.gridSize,
    side: Math.round(Math.sqrt(DIFFICULTY_PARAMS.normal.gridSize)),
    filledCells: DIFFICULTY_PARAMS.normal.filledCells,
    allowed: [...DIFFICULTY_PARAMS.normal.allowedTransforms],
    optionCount: DIFFICULTY_PARAMS.normal.optionCount,
  },
  {
    name: "hard",
    gridSize: DIFFICULTY_PARAMS.hard.gridSize,
    side: Math.round(Math.sqrt(DIFFICULTY_PARAMS.hard.gridSize)),
    filledCells: DIFFICULTY_PARAMS.hard.filledCells,
    allowed: [...DIFFICULTY_PARAMS.hard.allowedTransforms],
    optionCount: DIFFICULTY_PARAMS.hard.optionCount,
  },
  {
    name: "expert",
    gridSize: DIFFICULTY_PARAMS.expert.gridSize,
    side: Math.round(Math.sqrt(DIFFICULTY_PARAMS.expert.gridSize)),
    filledCells: DIFFICULTY_PARAMS.expert.filledCells,
    allowed: [...DIFFICULTY_PARAMS.expert.allowedTransforms],
    optionCount: DIFFICULTY_PARAMS.expert.optionCount,
  },
  {
    name: "adaptive-base",
    gridSize: ADAPTIVE_PARAMS.gridSize,
    side: Math.round(Math.sqrt(ADAPTIVE_PARAMS.gridSize)),
    filledCells: ADAPTIVE_PARAMS.filledCells,
    allowed: [...ADAPTIVE_PARAMS.allowedTransforms],
    optionCount: ADAPTIVE_PARAMS.optionCount,
  },
  {
    name: "adaptive-max-filled",
    gridSize: ADAPTIVE_PARAMS.gridSize,
    side: Math.round(Math.sqrt(ADAPTIVE_PARAMS.gridSize)),
    filledCells: ADAPTIVE_PARAMS.maxFilledCells!,
    allowed: [...ADAPTIVE_PARAMS.allowedTransforms],
    optionCount: ADAPTIVE_PARAMS.optionCount,
  },
  {
    name: "adaptive-max-options",
    gridSize: ADAPTIVE_PARAMS.gridSize,
    side: Math.round(Math.sqrt(ADAPTIVE_PARAMS.gridSize)),
    filledCells: ADAPTIVE_PARAMS.filledCells,
    allowed: [...ADAPTIVE_PARAMS.allowedTransforms],
    optionCount: ADAPTIVE_PARAMS.maxOptionCount!,
  },
  {
    name: "adaptive-max-both",
    gridSize: ADAPTIVE_PARAMS.gridSize,
    side: Math.round(Math.sqrt(ADAPTIVE_PARAMS.gridSize)),
    filledCells: ADAPTIVE_PARAMS.maxFilledCells!,
    allowed: [...ADAPTIVE_PARAMS.allowedTransforms],
    optionCount: ADAPTIVE_PARAMS.maxOptionCount!,
  },
];

function patternsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

describe("inventory: every production difficulty/profile", () => {
  it("covers 8 distinct production combos", () => {
    expect(PRODUCTION_PROFILES).toHaveLength(8);
    const names = PRODUCTION_PROFILES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("all-profile / many-seed final-validator sweeps (exact option count, distinctness, hidden-source unambiguity, no symmetry bypass)", () => {
  for (const profile of PRODUCTION_PROFILES) {
    it(`${profile.name}: 300 seeds each pass final validator with exact option count and hidden-source unambiguity`, () => {
      for (let seed = 0; seed < 300; seed += 1) {
        const rng = createRng(`convergence:${profile.name}:${seed}`);
        const round = generateRoundData({
          rng,
          roundIndex: seed % 7,
          gridSize: profile.gridSize,
          side: profile.side,
          filledCells: profile.filledCells,
          allowedTransforms: profile.allowed,
          optionCount: profile.optionCount,
          prevSource: null,
          prevTransform: null,
        });

        expect(round.options).toHaveLength(profile.optionCount);
        expect(isSymmetric(round.source, round.transformType, profile.side)).toBe(false);
        expect(patternsEqual(round.correctPattern as readonly number[], applyTransform(round.source, round.transformType, profile.side))).toBe(true);
        expect(patternsEqual(round.source as readonly number[], round.correctPattern as readonly number[])).toBe(false);
        for (let i = 0; i < round.options.length; i += 1) {
          for (let j = i + 1; j < round.options.length; j += 1) {
            expect(patternsEqual(round.options[i] as readonly number[], round.options[j] as readonly number[])).toBe(false);
          }
        }
        const allowedResults = profile.allowed.map((t) => applyTransform(round.source, t, profile.side));
        let defensible = 0;
        for (const opt of round.options) {
          for (const res of allowedResults) {
            if (patternsEqual(opt as readonly number[], res)) {
              defensible += 1;
              break;
            }
          }
        }
        expect(defensible).toBe(1);

        const validation = validateGeneratedRound(
          {
            rng: createRng("unused"),
            roundIndex: seed % 7,
            gridSize: profile.gridSize,
            side: profile.side,
            filledCells: profile.filledCells,
            allowedTransforms: profile.allowed,
            optionCount: profile.optionCount,
            prevSource: null,
            prevTransform: null,
          },
          round,
        );
        expect(validation.valid).toBe(true);
      }
    });
  }
});

describe("fallback / near-exhaustion paths exercise same validator", () => {
  it("consecutive rounds with near-duplicate pressure still produce valid rounds", () => {
    for (const profile of PRODUCTION_PROFILES) {
      const rng = createRng(`fallback-consec:${profile.name}`);
      let prevSource: readonly number[] | null = null;
      let prevTransform: TransformType | null = null;
      for (let round = 0; round < 20; round += 1) {
        const data = generateRoundData({
          rng,
          roundIndex: round,
          gridSize: profile.gridSize,
          side: profile.side,
          filledCells: profile.filledCells,
          allowedTransforms: profile.allowed,
          optionCount: profile.optionCount,
          prevSource,
          prevTransform,
        });
        expect(data.options).toHaveLength(profile.optionCount);
        const v = validateGeneratedRound(
          {
            rng: createRng("unused"),
            roundIndex: round,
            gridSize: profile.gridSize,
            side: profile.side,
            filledCells: profile.filledCells,
            allowedTransforms: profile.allowed,
            optionCount: profile.optionCount,
            prevSource,
            prevTransform,
          },
          data,
        );
        expect(v.valid).toBe(true);
        if (prevSource) {
          expect(patternDistance(data.source, prevSource)).toBeGreaterThanOrEqual(MIN_PATTERN_DISTANCE);
        }
        prevSource = data.source;
        prevTransform = data.transformType;
      }
    }
  });

  it("reuses same seed deterministically even after fallback (outer retry) — final validator still passes", () => {
    const symmetricSources: number[][] = [];
    outer: for (let a = 0; a < 9; a += 1) {
      for (let b = a + 1; b < 9; b += 1) {
        for (let c = b + 1; c < 9; c += 1) {
          const pat = [a, b, c];
          if (isSymmetric(pat, "rotate90", 3)) {
            symmetricSources.push(pat);
            if (symmetricSources.length >= 3) break outer;
          }
        }
      }
    }
    for (let seed = 0; seed < 50; seed += 1) {
      const mk = () =>
        generateRoundData({
          rng: createRng(`deterministic-fallback:${seed}`),
          roundIndex: 0,
          gridSize: 9,
          side: 3,
          filledCells: 3,
          allowedTransforms: ["rotate90"],
          optionCount: 2,
          prevSource: symmetricSources[0] ?? null,
          prevTransform: null,
        });
      const a = mk();
      const b = mk();
      expect(a).toEqual(b);
      const v = validateGeneratedRound(
        {
          rng: createRng("unused"),
          roundIndex: 0,
          gridSize: 9,
          side: 3,
          filledCells: 3,
          allowedTransforms: ["rotate90"],
          optionCount: 2,
          prevSource: symmetricSources[0] ?? null,
          prevTransform: null,
        },
        a,
      );
      expect(v.valid).toBe(true);
      expect(isSymmetric(a.source, a.transformType, 3)).toBe(false);
    }
  });

  it("explicitly validates that no fallback can bypass invariant (validator rejects short/ambiguous artificially constructed rounds)", () => {
    const baseInput = {
      rng: createRng("validator-bypass"),
      roundIndex: 0,
      gridSize: 9,
      side: 3,
      filledCells: 3,
      allowedTransforms: ["rotate90", "rotate180"] as TransformType[],
      optionCount: 3,
      prevSource: null as readonly number[] | null,
      prevTransform: null as TransformType | null,
    };
    const validRound = generateRoundData({ ...baseInput, rng: createRng("valid-for-bypass") });
    const shortRound = {
      ...validRound,
      options: validRound.options.slice(0, 2),
      correctOptionIndex: 0,
    };
    const shortResult = validateGeneratedRound(baseInput, shortRound as unknown as RoundData);
    expect(shortResult.valid).toBe(false);
    expect(shortResult.reason).toMatch(/optionCount/i);

    const source = validRound.source;
    const t0 = applyTransform(source, "rotate90", 3);
    const t1 = applyTransform(source, "rotate180", 3);
    let ambiguousSource: readonly number[] = source;
    let ambiguousT0 = t0;
    let ambiguousT1 = t1;
    if (patternsEqual(t0, t1)) {
      const alt = generateRoundData({ ...baseInput, rng: createRng("alt-ambig") });
      ambiguousSource = alt.source;
      ambiguousT0 = applyTransform(ambiguousSource, "rotate90", 3);
      ambiguousT1 = applyTransform(ambiguousSource, "rotate180", 3);
    }
    const ambiguousRound = {
      source: ambiguousSource,
      transformType: "rotate90" as TransformType,
      correctPattern: ambiguousT0,
      options: [ambiguousT0, ambiguousT1, [0, 1, 2]] as readonly (readonly number[])[],
      correctOptionIndex: 0,
    };
    const ambSorted: RoundData = {
      ...ambiguousRound,
      options: ambiguousRound.options.map((o) => [...o].sort((a, b) => a - b)) as readonly (readonly number[])[],
    } as RoundData;
    if (!patternsEqual(ambiguousT0, ambiguousT1)) {
      const ambResult = validateGeneratedRound(
        {
          ...baseInput,
          gridSize: 9,
          side: 3,
          filledCells: ambiguousSource.length,
          allowedTransforms: ["rotate90", "rotate180"],
          optionCount: 3,
        },
        ambSorted,
      );
      expect(ambResult.valid).toBe(false);
      expect(ambResult.reason).toMatch(/hidden-source ambiguity/i);
    }

    let symFound: { source: number[]; transform: TransformType } | null = null;
    for (let a = 0; a < 9; a += 1) {
      for (let b = a + 1; b < 9; b += 1) {
        for (let c = b + 1; c < 9; c += 1) {
          const pat: number[] = [a, b, c];
          if (isSymmetric(pat, "rotate180", 3)) {
            symFound = { source: pat, transform: "rotate180" };
            break;
          }
        }
        if (symFound) break;
      }
      if (symFound) break;
    }
    if (symFound) {
      const correct = applyTransform(symFound.source, symFound.transform, 3);
      const symRound: RoundData = {
        source: symFound.source,
        transformType: symFound.transform,
        correctPattern: correct,
        options: [correct, [0, 1, 2]] as readonly (readonly number[])[],
        correctOptionIndex: 0,
      } as RoundData;
      const symResult = validateGeneratedRound(
        {
          ...baseInput,
          gridSize: 9,
          side: 3,
          filledCells: 3,
          allowedTransforms: [symFound.transform],
          optionCount: 2,
        },
        symRound,
      );
      expect(symResult.valid).toBe(false);
      expect(symResult.reason).toMatch(/symmetric/i);
    }

    expect(OUTER_GENERATION_ATTEMPTS).toBeGreaterThan(10);
  });
});
