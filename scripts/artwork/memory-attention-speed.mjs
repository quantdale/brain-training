/** Mechanic-led Memory, Attention and Speed cover scenes.
 * Geometry uses the common 320×200 space; type belongs to native overlays.
 * Reaction Time is deliberately absent: its accepted ImageGen asset is owned
 * by the integrating author. No domain fallback is exported here.
 */
import {
  PIGMENTS, INK, PAPER, MUTE, rect, line, path, circle, group, tile, disc, symbol, grid, arrow, label,
} from './primitives.mjs';

const [MEMORY, MEMORY_LIGHT, MEMORY_DARK] = PIGMENTS.memory;
const [ATTENTION, ATTENTION_LIGHT, ATTENTION_DARK] = PIGMENTS.attention;
const [SPEED, SPEED_LIGHT, SPEED_DARK] = PIGMENTS.speed;

function cover(domain, concept, mechanic, interaction, object, distinction, svg, labels = []) {
  return { domain, concept, mechanic, interaction, object, distinction, svg, labels };
}

/** A narrow opaque under-stroke preserves mechanic cues on both themes.
 * Lowering opacity on a dark pigment would erase the motion in dark mode.
 */
function motion(d, color, width = 3, extra = '') {
  return path(d, 'none', PAPER, width + 2.5, extra) + path(d, 'none', color, width, extra);
}

function motionArrow(x1, y1, x2, y2, color, width = 3) {
  return arrow(x1, y1, x2, y2, PAPER, width + 2.5) + arrow(x1, y1, x2, y2, color, width);
}

function memory() {
  const board = grid(99, 27, 3, 3, 35, [0, 5, 6], MEMORY, 7);
  // Long dashed jumps distinguish arbitrary ordered recall from an adjacent
  // path; the native step numerals are retained at small card sizes.
  const jumps = motion('M140 47 L185 79 M185 104 L140 126', MEMORY_DARK, 3,
    'stroke-dasharray="4 6"');
  const flash = line(87, 31, 77, 25, MEMORY_LIGHT, 4)
    + line(87, 44, 74, 44, MEMORY_LIGHT, 4)
    + line(236, 85, 247, 85, MEMORY_LIGHT, 4);
  return cover('memory', 'Scattered flashing positions carry an ordered 1–2–3 recall sequence.',
    'Watch a sequence of distinct positions on a grid, then reproduce their original order.',
    'Tap the previously illuminated cells in order.', 'Scattered sequential flashes on a tile board.',
    'Arbitrary positional jumps and no repeats, rather than an adjacent path or repeat-capable Simon pads.',
    board + jumps + flash,
    [label(116.5, 44.5, '1', 24, PAPER), label(200.5, 86.5, '2', 24, PAPER), label(116.5, 128.5, '3', 24, PAPER)]);
}

function gridRecall() {
  // A simultaneous static pattern has no arrows or sequence numbers. The
  // offset ghost is the same arrangement being reconstructed from memory.
  const ghost = group(grid(177, 78, 3, 3, 24, [], MEMORY, 4), '', 'opacity=".48"')
    + [0, 2, 4, 7].map((i) => rect(177 + (i % 3) * 28, 78 + Math.floor(i / 3) * 28,
      24, 24, 'none', 4, `stroke="${MEMORY_DARK}" stroke-width="2.5" stroke-dasharray="4 3"`)).join('');
  const pattern = tile(53, 30, 129, 129, MEMORY_DARK, 16)
    + grid(63, 40, 3, 3, 33, [0, 2, 4, 7], MEMORY_LIGHT, 5);
  return cover('memory', 'A whole illuminated cell pattern is echoed as an empty remembered arrangement.',
    'Study a simultaneous set of lit cells and rebuild the same set after it hides.',
    'Select the remembered positions, with no required selection order.', 'One whole highlighted spatial pattern.',
    'Recall the set of positions, not an ordered flashing sequence.', ghost + pattern);
}

function pairRecall() {
  const cards = tile(45, 47, 82, 96, PAPER, 17)
    + tile(192, 47, 82, 96, PAPER, 17)
    + symbol('star', 86, 94, 47, MEMORY);
  const link = motion('M132 91 H185 M132 101 H185', MEMORY_DARK, 5)
    + circle(132, 96, 7, MEMORY_LIGHT) + circle(185, 96, 7, MEMORY_LIGHT);
  const recall = motion('M86 155 Q159 185 233 155 M225 151 L234 155 L228 164', MEMORY, 3);
  return cover('memory', 'A shape card is linked to its letter partner, with a recall loop beneath.',
    'Learn shape-to-letter associations, then recall the partner of a cued shape; pairings change between rounds.',
    'Tap the remembered partner letter.', 'A shape and its distinct letter partner.',
    'Association recall, not a facedown card-pair search.', cards + link + recall,
    [label(233, 95, 'K', 46, MEMORY_DARK)]);
}

function patternTapBack() {
  const pathCells = [[64, 103], [106, 103], [148, 61], [190, 61], [232, 103]];
  const route = motion('M82 121 H124 L166 79 H208 L250 121', MEMORY_DARK, 13);
  const pads = pathCells.map(([x, y], index) => tile(x, y, 36, 36,
    index === pathCells.length - 1 ? MEMORY : MEMORY_LIGHT, 8)).join('');
  const endpoint = circle(250, 121, 24, 'none', `stroke="${MEMORY}" stroke-width="3"`)
    + circle(250, 121, 30, 'none', `stroke="${MEMORY_LIGHT}" stroke-width="2"`);
  const context = group(rect(55, 48, 224, 107, 'none', 15,
    `stroke="${MEMORY_DARK}" stroke-width="2" stroke-dasharray="3 8"`), '', 'opacity=".25"');
  return cover('memory', 'A connected trail of neighboring tactile tiles ends at a tap ripple.',
    'Watch a nonrepeating path of cells flash, with each step next to the previous cell, then repeat it.',
    'Tap the adjacent route in the original order.', 'A continuous stepping-stone path.',
    'Neighbor-to-neighbor path recall, unlike the arbitrary jumps of Memory.', context + route + pads + endpoint);
}

function cueKeeper() {
  // A pinned pocket represents the retained watchlist. The live symbol is
  // free of a second card/relocation arrow, keeping this distinct from Tracker.
  const pocket = tile(34, 39, 74, 111, PAPER, 15)
    + rect(41, 46, 60, 97, 'none', 9,
      `stroke="${MEMORY_LIGHT}" stroke-width="2" stroke-dasharray="5 4"`)
    + line(71, 31, 71, 47, MEMORY_DARK, 3)
    + disc(71, 30, 6, MEMORY)
    + symbol('star', 71, 78, 34, MEMORY)
    + symbol('diamond', 71, 121, 23, MEMORY_LIGHT);
  const current = symbol('star', 204, 78, 66, MEMORY)
    + line(234, 44, 243, 34, MEMORY_LIGHT, 4)
    + line(243, 61, 257, 58, MEMORY_LIGHT, 4);
  const fillers = symbol('circle', 130, 80, 16, MEMORY_LIGHT)
    + symbol('diamond', 279, 80, 18, '#E7BAD0');
  const response = tile(164, 135, 128, 39, MEMORY_DARK, 12)
    + tile(116, 141, 40, 31, '#E9D8E2', 9)
    + motionArrow(204, 116, 204, 129, MEMORY, 3);
  return cover('memory', 'A pinned symbol watchlist is retained while an arriving matching star calls for the explicit SIGNAL response.',
    'Hold a changing memorized symbol watchlist and respond SIGNAL when an active symbol appears in a stream.',
    'Tap GO for other symbols and SIGNAL for the memorized intentions.', 'A pinned memory pocket, arriving star and distinct SIGNAL control.',
    'Remember changing prospective intentions; no continuously displayed reminder and no stop-digit withholding.',
    pocket + fillers + current + response,
    [label(228, 154.5, 'SIGNAL', 22, PAPER), label(136, 156.5, 'GO', 20, MEMORY_DARK)]);
}

function runningOrder() {
  // Earlier shapes disappear while the trailing three stay in one crisp
  // retained window. These are symbol identities, never number-order cards.
  const old = symbol('circle', 30, 77, 24, '#E6CAD8')
    + symbol('diamond', 67, 77, 27, MEMORY_LIGHT)
    + motionArrow(22, 110, 77, 110, MEMORY, 3);
  const recent = [
    { x: 105, kind: 'triangle' },
    { x: 164, kind: 'star' },
    { x: 223, kind: 'square' },
  ].map(({ x, kind }) => tile(x, 49, 46, 52, PAPER, 11)
    + symbol(kind, x + 23, 75, 28, MEMORY)).join('');
  const window = motion('M111 35 H94 V115 H111 M268 35 H286 V115 H268', MEMORY_DARK, 5);
  const recall = motion('M287 105 Q304 138 274 153 M282 143 L274 153 L285 154', MEMORY, 3)
    + [109, 168, 227].map((x) => rect(x, 138, 38, 34, '#FBE6F0', 8,
      `stroke="${MEMORY}" stroke-width="2.5" stroke-dasharray="5 4"`)).join('');
  return cover('memory', 'Faded earlier symbols leave a crisp last-three window, then a recall arrow returns to three empty slots.',
    'Watch a symbol stream, discard its older items, and recall only the trailing few in order.',
    'Tap the last symbols in their original order after the stream ends.', 'A sliding trailing-memory window and empty response slots.',
    'Only the temporal tail matters; these are symbols, not numbers to sort.', old + recent + window + recall);
}

function sequenceMemory() {
  // A single tactile four-pad console is the Simon-style game's distinctive
  // object; a pulse on one pad conveys flashing rather than a static pattern.
  const chassis = tile(77, 24, 166, 148, INK, 25)
    + rect(85, 32, 150, 132, MEMORY_DARK, 19);
  const pads = tile(94, 42, 60, 51, '#E469A0', 13)
    + tile(166, 42, 60, 51, '#71ADDD', 13)
    + tile(94, 105, 60, 51, '#E4B864', 13)
    + tile(166, 105, 60, 51, '#65C49E', 13);
  const pulse = rect(99, 47, 50, 41, 'none', 10,
    'stroke="#FFFFFF" stroke-width="2.5" opacity=".9"')
    + circle(124, 67, 7, PAPER)
    + line(67, 53, 57, 47, MEMORY_LIGHT, 4)
    + line(70, 68, 56, 68, MEMORY_LIGHT, 4)
    + line(77, 38, 74, 27, MEMORY_LIGHT, 4);
  return cover('memory', 'Four colored tactile Simon pads form one console, with one pad actively pulsing.',
    'Repeat an increasingly long Simon-style sequence, including legal nonadjacent repeated pads, in a score attack.',
    'Tap the colored pads in the observed sequence.', 'A single four-color tactile pad console.',
    'Repeat-capable colored-pad sequences; unlike Memory, a pad can recur in one sequence.', chassis + pads + pulse);
}

function oddOneOut() {
  const centers = [[59, 74], [112, 74], [165, 74], [218, 74], [271, 74]];
  const majority = centers.map(([x, y], index) => index === 3 ? ''
    : symbol('triangle', x, y, 32, ATTENTION)).join('');
  const odd = tile(188, 44, 60, 61, PAPER, 15)
    + group(symbol('triangle', 218, 74, 35, ATTENTION), 'rotate(90 218 74)')
    + circle(218, 74, 37, 'none', `stroke="${ATTENTION_DARK}" stroke-width="3"`)
    + motion('M218 149 V121 M208 132 L218 120 L228 132', ATTENTION_DARK, 4);
  return cover('attention', 'One sideways triangle stands apart from an otherwise identical upright group.',
    'Find the one item differing from an identical majority by shape, color or orientation.',
    'Tap the single anomalous item before time expires.', 'A rotated minority form against a repeated majority.',
    'Form and orientation deviance, rather than Visual Search’s simple filled-tile singleton.', majority + odd);
}

function signalWatch() {
  const stream = group(tile(37, 74, 48, 57, PAPER, 10), '', 'opacity=".6"')
    + group(tile(241, 74, 43, 57, PAPER, 10), '', 'opacity=".6"');
  const stop = path('M137 38 H185 L218 71 V119 L185 152 H137 L104 119 V71Z',
    ATTENTION_DARK, ATTENTION_DARK, 1)
    + path('M142 48 H181 L208 75 V115 L181 142 H142 L114 115 V75Z',
      'none', PAPER, 2);
  const hold = line(136, 171, 185, 171, ATTENTION_DARK, 5)
    + line(136, 161, 136, 177, ATTENTION_DARK, 5)
    + line(185, 161, 185, 177, ATTENTION_DARK, 5);
  return cover('attention', 'A stream of digits meets a central stop-digit boundary and a withheld response.',
    'Tap GO for each streamed digit except the stop digit, which requires withholding.',
    'Tap or deliberately do nothing on each number.', 'A numeral stream interrupted by a stop sign.',
    'Simple digit-based inhibition, not Cue Keeper’s changing memorized set of symbols.', stream + stop + hold,
    [label(61, 101, '2', 27, ATTENTION_DARK), label(161, 95, '3', 47, PAPER), label(262, 101, '5', 27, ATTENTION_DARK)]);
}

function symbolTracker() {
  const left = tile(33, 50, 100, 100, PAPER, 15)
    + symbol('star', 62, 78, 29, ATTENTION)
    + symbol('diamond', 104, 122, 22, MUTE)
    + circle(62, 78, 21, 'none', `stroke="${ATTENTION_DARK}" stroke-width="3"`);
  const right = tile(185, 50, 100, 100, PAPER, 15)
    + symbol('star', 256, 122, 29, ATTENTION)
    + symbol('diamond', 213, 78, 22, MUTE)
    + symbol('circle', 254, 78, 19, MUTE)
    + circle(256, 122, 21, 'none', `stroke="${ATTENTION_DARK}" stroke-width="3"`);
  const relocation = motion('M117 50 Q168 12 209 43 M198 41 L210 44 L207 32', ATTENTION_DARK, 4);
  return cover('attention', 'The same ringed star changes position between two boards while decoys surround it.',
    'Remember highlighted symbol identities, then find them after a discrete board scramble adds distractors.',
    'Tap the previously tracked identities in their new cells.', 'An identifiable star relocated between two boards.',
    'Track identity through a scramble, rather than recall original positions or follow continuous motion.', left + right + relocation);
}

function targetCount() {
  const targets = [[70, 67], [119, 101], [69, 138]].map(([x, y]) => symbol('star', x, y, 32, ATTENTION)).join('');
  const distractors = symbol('circle', 122, 54, 22, MUTE) + symbol('diamond', 123, 148, 24, MUTE);
  const total = tile(203, 66, 71, 80, PAPER, 17)
    + motionArrow(151, 105, 188, 105, ATTENTION_DARK, 4);
  return cover('attention', 'Three obvious target stars among subdued distractors lead to a numerical total.',
    'Count occurrences of a target glyph in a briefly shown mixed field, then choose the total.',
    'Select the numerical count, not the position of a target.', 'A countable set of repeated stars and one total chip.',
    'Multiple target occurrences and a quantity response, rather than a singleton search.', targets + distractors + total,
    [label(238.5, 105, '3', 47, ATTENTION_DARK)]);
}

function visualSearch() {
  const field = grid(64, 43, 4, 3, 26, [], ATTENTION, 6);
  const handle = path('M204 126 L244 166', 'none', ATTENTION_DARK, 18)
    + path('M207 128 L241 162', 'none', ATTENTION, 9);
  const lens = circle(172, 94, 48, ATTENTION_LIGHT)
    + circle(172, 94, 43, PAPER)
    + tile(155, 77, 34, 34, ATTENTION, 6)
    + circle(172, 94, 48, 'none', `stroke="${ATTENTION_DARK}" stroke-width="8"`)
    + path('M142 76 Q149 60 169 59', 'none', '#FFFFFF', 4, 'opacity=".7"');
  return cover('attention', 'A large magnifying lens isolates the single filled tile in a pale tile field.',
    'Find the one colored tile among identical surface tiles before the round expires.',
    'Tap the visually distinct filled tile.', 'A search lens framing one filled tile.',
    'A simple color-filled singleton; Odd One Out instead compares repeated forms and orientation.', field + handle + lens);
}

function colorMatch() {
  const blue = '#4D8DE4';
  const swatch = tile(112, 25, 96, 77, blue, 17)
    + circle(125, 38, 4, PAPER);
  const choices = disc(82, 152, 22, SPEED) + disc(160, 152, 22, blue)
    + disc(238, 152, 22, MEMORY)
    + circle(160, 152, 29, 'none', `stroke="${SPEED_DARK}" stroke-width="3"`);
  const match = motionArrow(160, 111, 160, 133, SPEED_DARK, 3);
  return cover('speed', 'A large physical blue swatch connects directly to its matching blue response chip.',
    'Choose the response matching the swatch color while ignoring the ink color of the accompanying word.',
    'Tap the button with the swatch’s hue as quickly as possible.', 'A large color swatch above three color response chips.',
    'Match a visible swatch; do not solve Color Stroop’s changing word-versus-ink task.', swatch + choices + match);
}

function orderSweep() {
  const sweep = motion('M67 119 Q103 34 159 62 Q221 59 254 128 M243 120 L254 130 L256 115', SPEED_DARK, 5);
  const tokens = disc(67, 119, 29, PAPER) + disc(159, 62, 29, SPEED_LIGHT)
    + disc(254, 130, 29, SPEED);
  return cover('speed', 'A sweeping stroke links scattered number tokens from 2 to 5 to 9.',
    'Scan numbers all visible at once and clear them from smallest to largest before the timer drains.',
    'Tap the number tokens in ascending order.', 'A spatial sweep through shuffled numeral discs.',
    'Simultaneous plain integers, rather than Running Order’s temporal symbols or Value Order’s expressions.', sweep + tokens,
    [label(67, 119, '2', 32, SPEED_DARK), label(159, 62, '5', 32, SPEED_DARK), label(254, 130, '9', 32, INK)]);
}

function quickCompare() {
  const cards = tile(42, 48, 91, 103, PAPER, 17)
    + tile(190, 48, 91, 103, SPEED_LIGHT, 17)
    + disc(161, 99, 24, SPEED_DARK);
  const decision = line(151, 155, 174, 155, SPEED_DARK, 4)
    + path('M156 163 L151 172 H174 L169 163', 'none', SPEED_DARK, 3);
  return cover('speed', 'Two large numerical cards face one another across a bold comparison sign.',
    'Judge equality, greater magnitude or the larger sum for two shown values under time pressure.',
    'Choose the correct comparison answer before the response window closes.', 'Two facing numeric stimulus cards.',
    'One paired numeric decision, rather than constructing arithmetic or sweeping an entire number field.', cards + decision,
    [label(87.5, 99, '8', 42, SPEED_DARK), label(235.5, 99, '12', 42, SPEED_DARK), label(161, 99, '<', 37, PAPER)]);
}

function tapRush() {
  const ghosts = [[62, 130, 16], [116, 67, 21]].map(([x, y, r]) =>
    circle(x, y, r, 'none', `stroke="${PAPER}" stroke-width="6"`)
    + circle(x, y, r, 'none', `stroke="${SPEED_LIGHT}" stroke-width="3"`)).join('');
  const route = motion('M73 117 L103 83 M138 71 L178 88', SPEED, 3,
    'stroke-dasharray="3 8"');
  const target = disc(225, 107, 35, SPEED)
    + circle(225, 107, 47, 'none', `stroke="${SPEED_DARK}" stroke-width="4"`)
    + circle(225, 107, 59, 'none', `stroke="${SPEED_LIGHT}" stroke-width="4"`)
    + circle(225, 107, 10, PAPER);
  const impact = motion('M275 47 L285 36 M287 65 L295 61 M263 34 L266 24', SPEED_DARK, 4);
  return cover('speed', 'One active circular target bursts with a tap ripple while prior positions fade across open space.',
    'Hit one appearing circular target at a time before its window closes as targets change field position.',
    'Tap the target’s current position; misses and empty-field taps break the streak.', 'A single pop-up target and fading previous positions.',
    'Rapid spatial aiming, unlike Reaction Time’s one stationary signal button.', ghosts + route + target + impact);
}

export const SCENES = {
  memory: memory(),
  'memory-grid-recall': gridRecall(),
  'memory-pair-recall': pairRecall(),
  'memory-pattern-tap-back': patternTapBack(),
  'memory-prospective-cue': cueKeeper(),
  'memory-running-order': runningOrder(),
  'memory-sequence-memory': sequenceMemory(),
  'attention-odd-one-out': oddOneOut(),
  'attention-sustained-vigilance': signalWatch(),
  'attention-symbol-tracker': symbolTracker(),
  'attention-target-count': targetCount(),
  'attention-visual-search': visualSearch(),
  'speed-color-match': colorMatch(),
  'speed-order-sweep': orderSweep(),
  'speed-quick-compare': quickCompare(),
  'speed-tap-rush': tapRush(),
};
