import { describe, expect, it } from "@jest/globals";

import {
  TIERS,
  blankCount,
  isGrammarCompatible,
  loadContentPack,
  validateContentPack,
} from "../content-validation";
import type { PackItem } from "../content-validation";

function clonePack(): any {
  return JSON.parse(
    JSON.stringify({
      packId: "language-context-fit-core-v1",
      packVersion: "1.0.0",
      itemCount: 1,
      items: [
        {
          id: "a",
          context: "The dog wagged its ___ happily.",
          answer: "tail",
          distractors: ["mountain", "idea", "season"],
          tier: "t1",
        },
      ],
    }),
  );
}

describe("bundled content pack", () => {
  it("validates and is the expected curated pack", () => {
    const pack = loadContentPack();
    expect(pack.packId).toBe("language-context-fit-core-v1");
    expect(pack.packVersion).toBe("2.0.0");
    expect(pack.itemCount).toBe(pack.items.length);
  });

  it("meets the packet floor: >= 60 items per tier and >= 180 total, declared==actual", () => {
    const pack = loadContentPack();
    expect(pack.itemCount).toBe(pack.items.length);
    expect(pack.items.length).toBeGreaterThanOrEqual(180);
    for (const tier of TIERS) {
      expect(
        pack.items.filter((item) => item.tier === tier).length,
      ).toBeGreaterThanOrEqual(60);
    }
  });

  it("regression: repaired t3 items keep their unambiguous, real-word answers", () => {
    const pack = loadContentPack();
    const byId = new Map(pack.items.map((item) => [item.id, item]));
    // cf-t3-10 previously read "A good metaphor should ___ an abstract idea
    // into something felt", where "translate" was a second defensible answer.
    expect(byId.get("cf-t3-10")!.context).toContain("alchemist");
    // cf-t3-11 previously used the non-word "anachronize" as the answer.
    expect(byId.get("cf-t3-11")!.answer).toBe("anachronism");
  });

  it("every item: exactly one blank, answer not among distractors, distinct distractors, >=3 distractors", () => {
    const pack = loadContentPack();
    for (const item of pack.items) {
      expect(blankCount(item.context)).toBe(1);
      expect(item.distractors.length).toBeGreaterThanOrEqual(3);
      expect(new Set(item.distractors.map((d) => d.toLowerCase())).size).toBe(
        item.distractors.length,
      );
      expect(item.distractors.map((d) => d.toLowerCase())).not.toContain(
        item.answer.toLowerCase(),
      );
    }
  });

  it("has no duplicate normalized answers or contexts across the pack", () => {
    const pack = loadContentPack();
    const answers = new Set(
      pack.items.map((i: PackItem) => i.answer.toLowerCase()),
    );
    const contexts = new Set(
      pack.items.map((i: PackItem) => i.context.toLowerCase()),
    );
    expect(answers.size).toBe(pack.items.length);
    expect(contexts.size).toBe(pack.items.length);
  });

  it("every item carries curated POS metadata and is grammar-compatible", () => {
    const pack = loadContentPack();
    for (const item of pack.items) {
      expect(["noun", "verb", "adj", "adv"]).toContain(item.pos);
    }
    for (const item of pack.items) {
      expect(isGrammarCompatible(item.answer, item.distractors, item.pos)).toBe(true);
    }
  });

  it("tier structure is valid: every tier value is t1/t2/t3 and counts are balanced", () => {
    const pack = loadContentPack();
    for (const item of pack.items) {
      expect(TIERS).toContain(item.tier);
    }
    const byTier = new Map(TIERS.map((t) => [t, pack.items.filter((i) => i.tier === t).length] as const));
    for (const tier of TIERS) {
      expect(byTier.get(tier)).toBeGreaterThanOrEqual(60);
    }
  });
});

describe("POS / morphology heuristic rejection", () => {
  it("rejects grammar-leaking distractors (plural/singular mismatch for noun slot)", () => {
    const p = clonePack();
    p.packVersion = "2.0.0";
    p.items = Array.from({ length: 180 }, (_, i) => ({
      id: `id-${i}`,
      tier: (["t1", "t2", "t3"] as const)[i % 3],
      context: `Sentence ${i} with a ___ here.`,
      answer: `answer${i}`,
      distractors: [`d${i}a`, `d${i}b`, `d${i}c`],
      pos: "noun" as const,
    }));
    p.items[0] = {
      id: "leak-plural",
      tier: "t1",
      context: "Birds build their ___ high in the trees.",
      answer: "nests",
      distractors: ["shadow", "tunnel", "recipe"],
      pos: "noun",
    };
    p.itemCount = p.items.length;
    expect(() => validateContentPack(p)).toThrow(/grammar-leaking/);
  });

  it("rejects grammar-leaking distractors (gerund mismatch for verb slot)", () => {
    const p = clonePack();
    p.packVersion = "2.0.0";
    p.items = Array.from({ length: 180 }, (_, i) => ({
      id: `id-${i}`,
      tier: (["t1", "t2", "t3"] as const)[i % 3],
      context: `Sentence ${i} with a ___ here.`,
      answer: `answer${i}`,
      distractors: [`d${i}a`, `d${i}b`, `d${i}c`],
      pos: "verb" as const,
    }));
    p.items[0] = {
      id: "leak-gerund",
      tier: "t2",
      context: "She kept ___ the data until it was correct.",
      answer: "checking",
      distractors: ["check", "checked", "checks"],
      pos: "verb",
    };
    p.itemCount = p.items.length;
    expect(() => validateContentPack(p)).toThrow(/grammar-leaking/);
  });

  it("requires POS metadata for packVersion >=2.0.0", () => {
    const p = clonePack();
    p.packVersion = "2.0.0";
    p.itemCount = 180;
    p.items = Array.from({ length: 180 }, (_, i) => ({
      id: `id-${i}`,
      tier: (["t1", "t2", "t3"] as const)[i % 3],
      context: `Sentence ${i} with a ___ here.`,
      answer: `answer${i}`,
      distractors: [`d${i}a`, `d${i}b`, `d${i}c`],
    }));
    expect(() => validateContentPack(p)).toThrow(/\.pos is required/);
  });
});

describe("curated ambiguity review fixtures — semantic single-answer audit", () => {
  const RISKY_REVIEWED: readonly { id: string; contextMustContain: string; answer: string; distractors: readonly string[] }[] = [
    { id: "cf-t2-05", contextMustContain: "small businesses", answer: "affect", distractors: ["decorate", "harvest", "forgive"] },
    { id: "cf-t3-02", contextMustContain: "evidence remained", answer: "anecdotal", distractors: ["empirical", "theoretical", "clinical"] },
    { id: "cf-t3-05", contextMustContain: "merely", answer: "overlapping", distractors: ["diverging", "rivaling", "collapsing"] },
    { id: "cf-t3-08", contextMustContain: "subtext was unmistakably", answer: "sardonic", distractors: ["serene", "symmetric", "sincere"] },
    { id: "cf-t3-21", contextMustContain: "allowing multiple readings", answer: "ambiguous", distractors: ["coherent", "rigorous", "explicit"] },
    { id: "cf-t3-28", contextMustContain: "classic", answer: "paradox", distractors: ["paradigm", "consensus", "doctrine"] },
    { id: "cf-t3-37", contextMustContain: "opposing views", answer: "synthesis", distractors: ["hypothesis", "dilemma", "paradox"] },
    { id: "cf-t3-41", contextMustContain: "cramped space", answer: "mitigate", distractors: ["exacerbate", "corroborate", "delineate"] },
    { id: "cf-t1-05", contextMustContain: "high in the trees", answer: "nests", distractors: ["shadows", "tunnels", "recipes"] },
    { id: "cf-t1-27", contextMustContain: "on the wall", answer: "mirror", distractors: ["harbor", "pebble", "canyon"] },
  ];

  it("all risky reviewed items are present, unchanged, and still have exactly one defensible answer", () => {
    const pack = loadContentPack();
    const byId = new Map(pack.items.map((i) => [i.id, i]));
    for (const fixture of RISKY_REVIEWED) {
      const item = byId.get(fixture.id);
      expect(item).toBeDefined();
      expect(item!.context).toContain(fixture.contextMustContain);
      expect(item!.answer).toBe(fixture.answer);
      expect(item!.distractors.slice().sort()).toEqual(fixture.distractors.slice().sort());
      expect(item!.distractors).not.toContain(item!.answer);
      expect(new Set(item!.distractors).size).toBe(item!.distractors.length);
    }
  });

  it("documents that mechanical validation alone is insufficient for these items", () => {
    const pack = loadContentPack();
    const riskyIds = new Set(RISKY_REVIEWED.map((r) => r.id));
    for (const item of pack.items) {
      if (riskyIds.has(item.id)) {
        expect(() => validateContentPack({ packId: pack.packId, packVersion: pack.packVersion, itemCount: pack.items.length, items: pack.items })).not.toThrow();
      }
    }
    expect(riskyIds.size).toBeGreaterThanOrEqual(10);
  });
});

describe("validateContentPack rejection cases", () => {
  it("rejects non-object and bad packId/packVersion", () => {
    expect(() => validateContentPack(null)).toThrow(/must be a JSON object/);
    const noId = clonePack();
    delete noId.packId;
    expect(() => validateContentPack(noId)).toThrow(/packId/);
    const badVersion = clonePack();
    badVersion.packVersion = "1.0";
    expect(() => validateContentPack(badVersion)).toThrow(/packVersion/);
  });

  it("rejects itemCount mismatch and bad tier", () => {
    const p = clonePack();
    p.itemCount = 2;
    expect(() => validateContentPack(p)).toThrow(/itemCount/);
    const badTier = clonePack();
    badTier.items[0].tier = "t4";
    expect(() => validateContentPack(badTier)).toThrow(/tier/);
  });

  it("rejects a missing or extra blank in the context", () => {
    const none = clonePack();
    none.items[0].context = "The dog wagged its tail happily.";
    expect(() => validateContentPack(none)).toThrow(/exactly one/);
    const two = clonePack();
    two.items[0].context = "The ___ dog wagged its ___ happily.";
    expect(() => validateContentPack(two)).toThrow(/exactly one/);
  });

  it("rejects a distractor equal to the answer or duplicate distractors or too few distractors", () => {
    const eq = clonePack();
    eq.items[0].distractors = ["tail", "idea", "season"];
    expect(() => validateContentPack(eq)).toThrow(/equals the answer/);
    const dup = clonePack();
    dup.items[0].distractors = ["mountain", "mountain", "season"];
    expect(() => validateContentPack(dup)).toThrow(/duplicate word/);
    const few = clonePack();
    few.items[0].distractors = ["mountain", "idea"];
    expect(() => validateContentPack(few)).toThrow(/>=3 words/);
  });

  it("rejects duplicate item ids (and only ids) when other fields are unique", () => {
    const dupId = clonePack();
    dupId.itemCount = 2;
    dupId.items.push({
      ...dupId.items[0],
      context: "A second ___ sentence here.",
      answer: "paw",
      distractors: ["x", "y", "z"],
    });
    expect(() => validateContentPack(dupId)).toThrow(/duplicate item id/);
  });

  it("rejects duplicate contexts (and only contexts) when other fields are unique", () => {
    const dupCtx = clonePack();
    dupCtx.itemCount = 2;
    dupCtx.items.push({
      ...dupCtx.items[0],
      id: "b",
      answer: "paw",
      distractors: ["x", "y", "z"],
    });
    expect(() => validateContentPack(dupCtx)).toThrow(/duplicate context/);
  });

  it("rejects duplicate normalized answers (and only answers) when other fields are unique", () => {
    const dupAns = clonePack();
    dupAns.itemCount = 2;
    dupAns.items.push({
      ...dupAns.items[0],
      id: "b",
      context: "A ___ sentence here.",
      answer: "tail",
      distractors: ["x", "y", "z"],
    });
    expect(() => validateContentPack(dupAns)).toThrow(
      /duplicate normalized answer/,
    );
  });
});
