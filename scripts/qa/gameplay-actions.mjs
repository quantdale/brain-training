/**
 * gameplay-actions.mjs — the ONE gameplay action policy shared by every
 * emulator-local driver (native-game-sweep.mjs, workout-journey.mjs).
 *
 * Why this module exists
 * ----------------------
 * The answer-surface vocabulary below was originally a private copy inside the
 * sweep harness. A private copy of an action policy is how the confirmed
 * `math-fast-math` stall happened: the advance-control list missed
 * `next-problem`, the loop stalled on a feedback overlay, and a healthy game
 * was reported L0. Keeping exactly one implementation (and one place to extend
 * when a game's control vocabulary grows) makes that class of false negative a
 * single-site fix for every driver.
 *
 * Contract: actions are chosen only from OBSERVED controls. A planned target
 * that is not in the inventory is never emitted as a tap.
 */
import { pickAdvanceControl } from './coverage-contract.mjs';

/**
 * Answer-surface families observed across the real 42-game catalog (from the
 * recorded control inventories): selectors, response/peg/guess surfaces,
 * swatch/shape/glyph pickers, keypad keys, binary buttons, colour/letter
 * options and math operators. Non-answer surfaces (score, stage, prompt,
 * status, live, display, scroll, verdict, …) are deliberately NOT matched.
 */
export const SELECTOR_RE = /(^|[.\-])(tile|card|option|options|word|choice|cell|item|node|target|target-card|number|operator|symbol|token|chip|response|digit|peg|pegs|guess|swatch|shape|glyph|block|row|slot|marker|cue|clue|question|command|commands|trigger|field|term|value|comparison|stimulus|pick|color|same|different|left|right|red|blue|green|yellow|purple|orange|[A-Z]|\+|\-|\*|\/)(\.\d+)?$/;

/**
 * INFORMATIONAL surfaces that LOOK like answers but are not: the briefing
 * chips/labels describe what is COMING (`briefing-chip.N`, `briefing-carrying`,
 * `briefing-retired`, `briefing-new-title`). They matched the generic `chip`
 * family and were tapped as fake answers while `briefing-start` waited — the
 * exact stall seen on `memory-prospective-cue`. A plain `chip.N` answer in a
 * real round is still tappable; only the briefing decoration is excluded.
 */
export const INFORMATIONAL_RE = /(^|[.\-])briefing-(chip|carrying|retired|new-title)([.\-]|$)/;

export function center(bounds) {
  return bounds ? [Math.round((bounds[0] + bounds[2]) / 2), Math.round((bounds[1] + bounds[3]) / 2)] : null;
}

/**
 * ENTRY family: round/session ENTRY affordances (`start`, `briefing-start`,
 * `go`, `begin-round`, …). These are NOT answers and NOT generic submits —
 * they open the round whose answers come after. Without this family the
 * confirmed `memory-prospective-cue` stall happens: the driver sits on the
 * briefing (`briefing-start`) or the intro (`start`) forever and the game is
 * reported as never progressing. `restart` is deliberately NOT an entry
 * (the verb must start a token), and cosmetic `-lip` overlays are skipped
 * like everywhere else.
 */
export const ENTRY_RE = /(^|[.\-])(start|play|begin|go|ready)([.\-]|$)/;

function entryScore(k) {
  if (/briefing-(start|go)|^go$|^start$|^begin$|^play$/.test(k)) return 0;
  if (/start-(game|round|stream)|begin-(game|round|stream)/.test(k)) return 1;
  return 2;
}

/**
 * Pick the next gameplay action from the OBSERVED playing-state controls.
 * Family adapters: selectors (tap), ordered sequences (index order), keypad
 * (keys + submit), submit flows (select then check), passive (wait only).
 *
 * `controls` maps a control key (suffix form, e.g. `tile.3` / `key.7`) to
 * `{ bounds }`. `tappedThisRound` is the set of keys already tapped this round.
 */
export function chooseGameplayAction(controls, tappedThisRound) {
  const suffixes = Object.keys(controls);
  const has = (k) => controls[k] && center(controls[k].bounds);
  const feedbackUp = suffixes.some((s) => /^(round-result|round-failed|verdict|feedback)/.test(s));
  const keypadKeys = suffixes.filter((s) => /^(key|pad)[.\-]/.test(s) && controls[s].bounds);
  const selectors = suffixes.filter((s) => SELECTOR_RE.test(s) && !INFORMATIONAL_RE.test(s) && controls[s].bounds);
  const ordered = suffixes.filter((s) => /^(sequence|order)[.\-]/.test(s) && controls[s].bounds)
    .sort((a, b) => (Number(/\d+$/.exec(a)?.[0]) || 0) - (Number(/\d+$/.exec(b)?.[0]) || 0));

  // A feedback / verdict board is up: advance the round first — poking board
  // controls under the overlay is not an answer attempt.
  if (feedbackUp) {
    // Pattern-based, so `next-problem`/`next-trial`/`submit-estimate` are
    // recognised instead of silently stalling the loop (see ADVANCE_RE).
    const advance = pickAdvanceControl(controls);
    if (advance && has(advance)) {
      return { type: 'tap', target: advance, point: center(controls[advance].bounds) };
    }
  }
  if (keypadKeys.length) {
    // Keypad family: enter a couple of digits, then submit/check if present.
    const key = keypadKeys.find((k) => !tappedThisRound.has(k)) || keypadKeys[0];
    return { type: 'tap', target: key, point: center(controls[key].bounds) };
  }
  if (ordered.length) {
    const next = ordered.find((k) => !tappedThisRound.has(k));
    return next ? { type: 'tap', target: next, point: center(controls[next].bounds) } : null;
  }
  if (selectors.length) {
    const next = selectors.find((k) => !tappedThisRound.has(k)) || selectors[0];
    return { type: 'tap', target: next, point: center(controls[next].bounds) };
  }
  const advance = pickAdvanceControl(controls);
  if (advance && has(advance)) {
    return { type: 'tap', target: advance, point: center(controls[advance].bounds) };
  }
  // ENTRY family last (after answers and submits): open the round before
  // declaring the surface passive. A `go`/`start` tap on a real game control
  // is still a real, observed input — but it is never preferred over an
  // answer surface.
  const entries = suffixes
    .filter((s) => ENTRY_RE.test(s) && !/-lip$/.test(s) && controls[s].bounds)
    .sort((a, b) => entryScore(a) - entryScore(b) || a.length - b.length);
  if (entries.length) {
    return { type: 'tap', target: entries[0], point: center(controls[entries[0]].bounds) };
  }
  return null; // passive / stimulus-driven: wait and observe instead
}
