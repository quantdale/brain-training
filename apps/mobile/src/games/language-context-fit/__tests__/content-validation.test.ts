import { describe, expect, it } from "@jest/globals";

import {
  TIERS,
  blankCount,
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
    expect(pack.packVersion).toBe("1.1.0");
    expect(pack.itemCount).toBe(pack.items.length);
  });

  it("meets the packet floor: >= 40 items with >= 12 per tier", () => {
    const pack = loadContentPack();
    expect(pack.items.length).toBeGreaterThanOrEqual(40);
    for (const tier of TIERS) {
      expect(
        pack.items.filter((item) => item.tier === tier).length,
      ).toBeGreaterThanOrEqual(12);
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
