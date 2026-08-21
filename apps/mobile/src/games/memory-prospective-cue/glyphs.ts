/**
 * Cue Keeper — symbol palette.
 *
 * One flat palette of 12 visually distinct glyphs (shape + color, the same
 * proven distinguishable family as the other Memory games). Any glyph can be
 * an active signal; fillers are drawn from the non-active remainder, so a
 * filler never collides with a held intention and the player can never
 * confuse "seen before" with "is a signal".
 *
 * Accessibility: labels describe identity ("orange star") only. Whether a
 * glyph is currently an active signal is NEVER part of the label — that is
 * exactly what the player must remember, so it must not be readable off the
 * accessibility tree.
 */
export interface StreamGlyph {
  /** Stable 0-based id (index into the palette). */
  readonly id: number;
  /** Unicode glyph rendered for the stream item. */
  readonly glyph: string;
  /** Hex color string for the glyph. */
  readonly color: string;
  /** Spoken/written identity label (accessibility + tutorial). */
  readonly label: string;
}

/** Stream symbols (12): enough for 6 simultaneous signals plus filler room. */
export const STREAM_GLYPHS: readonly StreamGlyph[] = Object.freeze([
  { id: 0, glyph: "●", color: "#EF4444", label: "red circle" },
  { id: 1, glyph: "■", color: "#3B82F6", label: "blue square" },
  { id: 2, glyph: "▲", color: "#22C55E", label: "green triangle" },
  { id: 3, glyph: "★", color: "#F59E0B", label: "orange star" },
  { id: 4, glyph: "◆", color: "#A855F7", label: "purple diamond" },
  { id: 5, glyph: "♥", color: "#EC4899", label: "pink heart" },
  { id: 6, glyph: "♣", color: "#14B8A6", label: "teal club" },
  { id: 7, glyph: "♠", color: "#64748B", label: "gray spade" },
  { id: 8, glyph: "☀", color: "#EAB308", label: "yellow sun" },
  { id: 9, glyph: "☂", color: "#06B6D4", label: "cyan umbrella" },
  { id: 10, glyph: "♪", color: "#F97316", label: "amber note" },
  { id: 11, glyph: "✚", color: "#84CC16", label: "lime cross" },
]);

export const GLYPH_COUNT = STREAM_GLYPHS.length;

/** Look up a stream glyph by id (safe: falls back to the first glyph). */
export function glyphById(id: number): StreamGlyph {
  return STREAM_GLYPHS[id] ?? STREAM_GLYPHS[0];
}
