/**
 * Paired-association palettes for the Pair Recall game.
 *
 * Stimuli are shape glyphs (drawn from the same proven, color+shape
 * distinguishable family as the other Memory games); responses are letters.
 * The two palettes are DISJOINT by construction — a stimulus glyph can never
 * appear as a response candidate or vice versa — so the cue side and the
 * choice side of every association stay visually unambiguous.
 *
 * Accessibility: labels describe identity ("red circle", "letter K") and never
 * reveal whether a response is the correct partner; correctness is only ever
 * conveyed after the player answers.
 */
export interface StimulusSymbol {
  /** Stable 0-based id (index into the palette). */
  readonly id: number;
  /** Unicode glyph rendered as the stimulus shape. */
  readonly glyph: string;
  /** Hex color string for the glyph. */
  readonly color: string;
  /** Spoken/written identity label (accessibility + tutorial). */
  readonly label: string;
}

export interface ResponseLetter {
  /** Stable 0-based id (index into the palette). */
  readonly id: number;
  /** The letter glyph. */
  readonly glyph: string;
  /** Spoken/written identity label (accessibility + tutorial). */
  readonly label: string;
}

/** Stimulus shapes (8): enough for the largest pair count with re-draw room. */
export const PAIR_STIMULI: readonly StimulusSymbol[] = Object.freeze([
  { id: 0, glyph: "●", color: "#EF4444", label: "red circle" },
  { id: 1, glyph: "■", color: "#3B82F6", label: "blue square" },
  { id: 2, glyph: "▲", color: "#22C55E", label: "green triangle" },
  { id: 3, glyph: "★", color: "#F59E0B", label: "orange star" },
  { id: 4, glyph: "◆", color: "#A855F7", label: "purple diamond" },
  { id: 5, glyph: "♥", color: "#EC4899", label: "pink heart" },
  { id: 6, glyph: "▼", color: "#14B8A6", label: "teal triangle-down" },
  { id: 7, glyph: "○", color: "#64748B", label: "gray ring" },
]);

/** Response letters (12): disjoint from the stimulus set. */
export const PAIR_RESPONSES: readonly ResponseLetter[] = Object.freeze([
  { id: 0, glyph: "B", label: "letter B" },
  { id: 1, glyph: "D", label: "letter D" },
  { id: 2, glyph: "F", label: "letter F" },
  { id: 3, glyph: "G", label: "letter G" },
  { id: 4, glyph: "H", label: "letter H" },
  { id: 5, glyph: "J", label: "letter J" },
  { id: 6, glyph: "K", label: "letter K" },
  { id: 7, glyph: "L", label: "letter L" },
  { id: 8, glyph: "N", label: "letter N" },
  { id: 9, glyph: "P", label: "letter P" },
  { id: 10, glyph: "R", label: "letter R" },
  { id: 11, glyph: "T", label: "letter T" },
]);

export const STIMULUS_COUNT = PAIR_STIMULI.length;
export const RESPONSE_COUNT = PAIR_RESPONSES.length;

/** Look up a stimulus by id (safe: falls back to the first stimulus). */
export function stimulusById(id: number): StimulusSymbol {
  return PAIR_STIMULI[id] ?? PAIR_STIMULI[0];
}

/** Look up a response letter by id (safe: falls back to the first letter). */
export function responseById(id: number): ResponseLetter {
  return PAIR_RESPONSES[id] ?? PAIR_RESPONSES[0];
}
