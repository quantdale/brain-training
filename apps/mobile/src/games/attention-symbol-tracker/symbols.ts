/**
 * Symbol alphabet for the Symbol Tracker game.
 *
 * The observe board is built from this fixed palette of twelve distinct
 * symbols. Every symbol is distinguishable by BOTH shape (glyph) and color, so
 * the game never leans on a single visual channel, and the accessibility label
 * describes the symbol's identity (never "this is a target"). Tracking is by
 * identity: the player is told which symbols to follow, then must recognize
 * them again after the board scrambles and distractors are added.
 */
export interface TrackerSymbol {
  /** Stable 0-based id (index into the palette). */
  readonly id: number;
  /** Unicode glyph rendered as the symbol's shape. */
  readonly glyph: string;
  /** Hex color string for the glyph. */
  readonly color: string;
  /** Spoken/written identity label (accessibility + tutorial). */
  readonly label: string;
}

export const SYMBOL_TRACKER_SYMBOLS: readonly TrackerSymbol[] = Object.freeze([
  { id: 0, glyph: '●', color: '#EF4444', label: 'red circle' },
  { id: 1, glyph: '■', color: '#2563EB', label: 'blue square' },
  { id: 2, glyph: '▲', color: '#16A34A', label: 'green triangle' },
  { id: 3, glyph: '★', color: '#EA580C', label: 'orange star' },
  { id: 4, glyph: '◆', color: '#9333EA', label: 'purple diamond' },
  { id: 5, glyph: '♥', color: '#DB2777', label: 'pink heart' },
  { id: 6, glyph: '✚', color: '#0D9488', label: 'teal plus' },
  { id: 7, glyph: '⬣', color: '#475569', label: 'slate hexagon' },
  { id: 8, glyph: '⬟', color: '#06B6D4', label: 'cyan pentagon' },
  { id: 9, glyph: '◼', color: '#CA8A04', label: 'amber square' },
  { id: 10, glyph: '⏺', color: '#7C3AED', label: 'violet ring' },
  { id: 11, glyph: '✶', color: '#059669', label: 'emerald star' },
]);

export const TRACKER_SYMBOL_COUNT = SYMBOL_TRACKER_SYMBOLS.length;

/** Look up a symbol by id (safe: returns the id itself for unknown ids). */
export function trackerSymbolById(id: number): TrackerSymbol {
  return SYMBOL_TRACKER_SYMBOLS[id] ?? SYMBOL_TRACKER_SYMBOLS[0];
}
