// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import { RUNNING_ORDER_SYMBOLS, SYMBOL_COUNT, symbolById } from "../symbols";

describe("RUNNING_ORDER_SYMBOLS", () => {
  it("exposes exactly twelve distinct symbols with contiguous ids", () => {
    // Campaign 014 memory-depth wave widened the palette from 6 to 12 so
    // consecutive target windows stop feeling samey.
    expect(SYMBOL_COUNT).toBe(12);
    expect(RUNNING_ORDER_SYMBOLS).toHaveLength(12);
    RUNNING_ORDER_SYMBOLS.forEach((symbol, index) => {
      expect(symbol.id).toBe(index);
    });
  });

  it("keeps every glyph, color, and label unique (dual-channel identity)", () => {
    const glyphs = new Set(RUNNING_ORDER_SYMBOLS.map((s) => s.glyph));
    const colors = new Set(RUNNING_ORDER_SYMBOLS.map((s) => s.color));
    const labels = new Set(RUNNING_ORDER_SYMBOLS.map((s) => s.label));
    expect(glyphs.size).toBe(SYMBOL_COUNT);
    expect(colors.size).toBe(SYMBOL_COUNT);
    expect(labels.size).toBe(SYMBOL_COUNT);
  });
});

describe("symbolById", () => {
  it("falls back to the first symbol for unknown ids", () => {
    expect(symbolById(0)).toBe(RUNNING_ORDER_SYMBOLS[0]);
    expect(symbolById(-1)).toBe(RUNNING_ORDER_SYMBOLS[0]);
    expect(symbolById(SYMBOL_COUNT)).toBe(RUNNING_ORDER_SYMBOLS[0]);
  });
});
