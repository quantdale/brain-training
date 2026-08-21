/**
 * Symbol alphabet for the Running Order game.
 *
 * The stimulus stream is drawn from this fixed palette of six distinct
 * symbols. Every symbol is distinguishable by BOTH shape (glyph) and color, so
 * color-blind or low-vision players can still tell them apart, and the
 * accessibility label describes the symbol's identity (never "this is the
 * answer"). Keeping the palette small and fixed makes generation deterministic
 * and the working-memory load driven purely by stream length / recall length.
 */
export interface RunningOrderSymbol {
 /** Stable 0-based id (index into the palette). */
 readonly id: number;
 /** Unicode glyph rendered as the symbol's shape. */
 readonly glyph: string;
 /** Hex color string for the glyph. */
 readonly color: string;
 /** Spoken/written identity label (accessibility + tutorial). */
 readonly label: string;
}

export const RUNNING_ORDER_SYMBOLS: readonly RunningOrderSymbol[] =
 Object.freeze([
  { id: 0, glyph: "●", color: "#EF4444", label: "red circle" },
  { id: 1, glyph: "■", color: "#3B82F6", label: "blue square" },
  { id: 2, glyph: "▲", color: "#22C55E", label: "green triangle" },
  { id: 3, glyph: "★", color: "#F59E0B", label: "orange star" },
  { id: 4, glyph: "◆", color: "#A855F7", label: "purple diamond" },
  { id: 5, glyph: "♥", color: "#EC4899", label: "pink heart" },
 ]);

export const SYMBOL_COUNT = RUNNING_ORDER_SYMBOLS.length;

/** Look up a symbol by id (safe: returns the id itself for unknown ids). */
export function symbolById(id: number): RunningOrderSymbol {
 return RUNNING_ORDER_SYMBOLS[id] ?? RUNNING_ORDER_SYMBOLS[0];
}
