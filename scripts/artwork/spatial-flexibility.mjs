/** Mechanic-first Spatial/Flexibility artwork. Build-time geometry only. */
import { PIGMENTS, INK, PAPER, rect, line, path, circle, tile, disc, group, arrow, symbol, label } from './primitives.mjs';

const [GREEN, MINT, GREEN_EDGE] = PIGMENTS.spatial;
const [PURPLE, LILAC, PURPLE_EDGE] = PIGMENTS.flexibility;

// Important action marks float over both light and dark domain surfaces.
// A small opaque paper edge preserves their silhouette without SVG filters.
function action(d, color, width = 4, extra = '') {
  return path(d, 'none', PAPER, width + 3.5, extra) + path(d, 'none', color, width, extra);
}

function actionArrow(x1, y1, x2, y2, color, width = 4) {
  return arrow(x1, y1, x2, y2, PAPER, width + 3.5) + arrow(x1, y1, x2, y2, color, width);
}

function paperCells(x, y, cols, rows, cell, filled, fill = GREEN) {
  const marks = new Set(filled);
  return Array.from({ length: rows * cols }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return rect(x + col * cell + 3, y + row * cell + 3, cell - 6, cell - 6,
      marks.has(index) ? fill : '#E4EEE9', 3);
  }).join('');
}

function foldMatch() {
  // One physical sheet mid-fold, not a pair of generic grids. The left half
  // is raised in perspective; the right half is the kept 2×4 base. Incoming
  // marks (hollow) occupy exactly the mirrored OR destinations of the flap.
  const base = tile(146, 61, 76, 108, PAPER, 3) +
    [1, 2, 3].map((row) => line(148, 61 + row * 27, 220, 61 + row * 27, '#C4D9CB', 1)).join('') +
    line(184, 63, 184, 167, '#C4D9CB', 1) +
    circle(203, 101.5, 9, GREEN) + circle(165, 155.5, 9, GREEN) +
    circle(203, 74.5, 9, MINT, `stroke="${GREEN_EDGE}" stroke-width="2" stroke-dasharray="3 3"`) +
    circle(165, 128.5, 9, MINT, `stroke="${GREEN_EDGE}" stroke-width="2" stroke-dasharray="3 3"`);
  const flapGrid = [1, 2, 3].map((row) => {
    const y = 29 + row * 26;
    return line(74, y, 146, y + 32, '#8CBA9A', 1);
  }).join('') + line(110, 45, 110, 149, '#8CBA9A', 1);
  return base +
    // A trapezoidal cast shadow and doubled lower edge make the paper lift
    // legible at card size. Its marks remain visible on the raised face.
    path('M146 63 L217 107 L217 169 L146 169Z', INK, 'none', 0, 'opacity=".12"') +
    path('M74 133 L146 165 L146 171 L74 139Z', '#8CB89C', GREEN_EDGE, 1) +
    path('M74 29 L146 61 L146 165 L74 133Z', '#D7F0E0', GREEN_EDGE, 2) +
    flapGrid +
    // The leftmost source column maps to the far right of the kept half.
    `<ellipse cx="92" cy="50" rx="9" ry="8" fill="${GREEN}" transform="rotate(24 92 50)"/>` +
    `<ellipse cx="128" cy="118" rx="9" ry="8" fill="${GREEN}" transform="rotate(24 128 118)"/>` +
    line(146, 61, 146, 169, GREEN_EDGE, 3, 'stroke-dasharray="5 5"') +
    action('M111 32 C166 16 221 26 239 65 M227 57 L240 67 L242 50', GREEN_EDGE, 4.5);
}

function blockShape(blocks, x, y, cell) {
  return group(blocks.map(({ col, row, color }) => {
    const bx = col * cell;
    const by = row * cell;
    return tile(bx, by, cell - 1, cell - 1, color, 4) +
      path(`M${bx + cell - 3} ${by + 7} L${bx + cell - 3} ${by + cell - 4} L${bx + 6} ${by + cell - 4}`,
        'none', INK, 1.5, 'opacity=".42"');
  }).join(''), `translate(${x} ${y})`);
}

function mentalRotation() {
  // The asymmetric F pentomino is connected, rotation-distinct and chiral.
  // Colors stay attached to the blocks through the exact clockwise turn.
  const cyan = '#4CBBD0', gold = '#E9B445';
  const target = [
    { col: 1, row: 0, color: GREEN },
    { col: 2, row: 0, color: gold },
    { col: 0, row: 1, color: cyan },
    { col: 1, row: 1, color: GREEN },
    { col: 1, row: 2, color: gold },
  ];
  const turned = target.map(({ col, row, color }) => ({ col: 2 - row, row: col, color }));
  return blockShape(target, 24, 54, 31) +
    action('M128 97 C138 57 179 57 191 97 M179 91 L192 99 L194 83', GREEN_EDGE, 4.5) +
    blockShape(turned, 204, 54, 31);
}

function coordinateTurn() {
  return disc(158, 106, 65, PAPER) + circle(158, 106, 57, '#E1F4E8') +
    line(158, 54, 158, 158, '#7DAF8D', 2) + line(106, 106, 210, 106, '#7DAF8D', 2) +
    [0, 90, 180, 270].map((angle) => group(line(158, 45, 158, 52, GREEN_EDGE, 3), `rotate(${angle} 158 106)`)).join('') +
    path('M158 60 L146 106 L170 106Z', 'none', GREEN_EDGE, 2, 'opacity=".42" stroke-dasharray="4 4"') +
    path('M212 106 L151 89 L151 123Z', GREEN, GREEN_EDGE, 1.5) +
    path('M115 106 L151 96 L151 116Z', MINT, GREEN_EDGE, 1) +
    circle(158, 106, 7, PAPER, `stroke="${GREEN_EDGE}" stroke-width="2"`) +
    action('M131 33 C184 17 232 52 233 97 M224 86 L233 99 L241 85', GREEN_EDGE, 4.5);
}

function gridNavigator() {
  const x = 82, y = 25, side = 150, cell = 30;
  return tile(x, y, side, side, PAPER, 8) +
    Array.from({ length: 4 }, (_, i) => line(x + (i + 1) * cell, y + 2, x + (i + 1) * cell, y + side - 2, '#B6D1C0', 1.5) +
      line(x + 2, y + (i + 1) * cell, x + side - 2, y + (i + 1) * cell, '#B6D1C0', 1.5)).join('') +
    path('M97 130 L157 130 L157 70 L217 70', 'none', PAPER, 12) +
    path('M97 130 L157 130 L157 70 L217 70', 'none', GREEN, 7) +
    circle(97, 130, 10, PAPER, `stroke="${GREEN_EDGE}" stroke-width="4"`) +
    path('M207 59 L220 70 L207 81Z', GREEN, GREEN_EDGE, 1.5);
}

function transformMatch() {
  const source = [0, 3, 4, 7];
  const mirrored = source.map((i) => Math.floor(i / 3) * 3 + (2 - i % 3));
  return tile(30, 56, 96, 96, PAPER, 7) + paperCells(33, 59, 3, 3, 30, source) +
    tile(194, 56, 96, 96, PAPER, 7) + paperCells(197, 59, 3, 3, 30, mirrored) +
    action('M160 34 L160 173', GREEN_EDGE, 3, 'stroke-dasharray="6 7"') +
    action('M134 104 L185 104 M176 96 L186 104 L176 112 M143 96 L133 104 L143 112', GREEN_EDGE, 4);
}

function card(x, y, w, h, shape, fill, selected = false, angle = 0) {
  const body = (selected ? rect(x - 4, y - 4, w + 8, h + 8, PURPLE_EDGE, 9) : '') +
    tile(x, y, w, h, PAPER, 7) + symbol(shape, x + w / 2, y + h / 2, w * .53, fill);
  return angle ? group(body, `rotate(${angle} ${x + w / 2} ${y + h / 2})`) : body;
}

function cardSort() {
  return card(134, 27, 52, 66, 'triangle', PURPLE) +
    card(42, 112, 48, 58, 'circle', PURPLE, false, -9) +
    card(103, 104, 48, 58, 'triangle', LILAC, true, -3) +
    card(165, 112, 48, 58, 'square', PURPLE_EDGE, false, 3) +
    card(226, 112, 48, 58, 'star', LILAC, false, 9) +
    action('M158 96 Q147 101 136 103 M145 92 L134 104 L149 105', PURPLE_EDGE, 4);
}

function colorStroop() {
  const blue = '#326FDA';
  return rect(55, 36, 210, 89, PURPLE_EDGE, 12) + tile(59, 40, 202, 81, PAPER, 9) +
    tile(38, 136, 97, 38, '#F0CDD3', 9) + tile(185, 136, 97, 38, blue, 9) +
    action('M172 122 Q194 132 216 132 M205 123 L218 133 L204 138', blue, 4);
}

function cueShift() {
  // Three independent attribute cues, with shape selected. The two number-
  // bearing cards disagree in color and number, matching only their shape.
  return disc(111, 47, 19, PAPER) + circle(107, 47, 8, PURPLE) + circle(116, 47, 8, LILAC) +
    circle(160, 47, 24, PURPLE_EDGE) + disc(160, 47, 19, PAPER) + symbol('triangle', 160, 47, 24, PURPLE) +
    disc(209, 47, 19, PAPER) +
    card(58, 91, 72, 81, 'triangle', PURPLE) +
    card(190, 91, 72, 81, 'triangle', LILAC) +
    actionArrow(141, 132, 177, 132, PURPLE_EDGE, 4) +
    action('M160 76 L160 96 M151 87 L160 98 L169 87', PURPLE_EDGE, 3.5);
}

function ruleFlip() {
  return rect(107, 56, 106, 115, INK, 9, 'opacity=".14"') +
    // Hinged lower face and strongly foreshortened lifted upper rule face.
    rect(107, 92, 106, 76, PURPLE_EDGE, 6) +
    rect(111, 96, 98, 68, PURPLE, 4) +
    path('M107 91 L213 91 L202 34 L118 34Z', '#B88CE2', PURPLE_EDGE, 2) +
    path('M107 91 L213 91 L213 97 L107 97Z', '#623F89', PURPLE_EDGE, 1) +
    symbol('triangle', 160, 65, 32, PAPER) +
    circle(107, 94, 5, PAPER, `stroke="${PURPLE_EDGE}" stroke-width="2"`) +
    circle(213, 94, 5, PAPER, `stroke="${PURPLE_EDGE}" stroke-width="2"`) +
    action('M231 62 C264 90 260 130 230 147 M231 132 L228 149 L245 145', PURPLE_EDGE, 4.5);
}

function taskSwitch() {
  return disc(160, 66, 38, PURPLE) +
    action('M160 109 L160 118 L91 144 M160 118 L229 144', PURPLE_EDGE, 4.5) +
    tile(42, 138, 99, 37, PAPER, 10) + tile(179, 138, 99, 37, PAPER, 10) +
    action('M104 126 L91 145 L112 144 M207 144 L229 145 L218 128', PURPLE_EDGE, 4);
}

export const SCENES = {
  'spatial-fold-match': {
    domain: 'spatial',
    mechanic: 'Study a marked grid, then choose its paper-folded OR-merged result.',
    interaction: 'Memorize the sheet and fold cue, then tap the correct folded pattern.',
    object: 'One paper sheet with a raised flap, crease and half-width kept base.',
    distinction: 'Paper folding merges marks and shrinks the sheet; this is not reflection on an unchanged board.',
    concept: 'One raised paper flap casts a trapezoid shadow; exact mirrored marks merge onto the kept half.',
    svg: foldMatch(),
    labels: [],
  },
  'spatial-mental-rotation': {
    domain: 'spatial',
    mechanic: 'Judge whether a colored connected 2D block shape is a rotated copy or a different arrangement.',
    interaction: 'Compare target and candidate, then choose Same or Different.',
    object: 'An asymmetric green, cyan and gold F pentomino and its true clockwise quarter-turn.',
    distinction: 'Free connected block silhouettes with attached colors, not filled-cell grid transformations.',
    concept: 'Two identical asymmetric polyominoes preserve three distinct block colors through an exact clockwise quarter-turn.',
    svg: mentalRotation(),
    labels: [],
  },
  'spatial-coordinate-turn': {
    domain: 'spatial',
    mechanic: 'Follow relative turn and movement commands on a free plane to determine heading or position.',
    interaction: 'Track orientation and choose a final direction or coordinate.',
    object: 'A compass needle pivoting from north to east.',
    distinction: 'Orientation around a pivot, rather than a bounded board route or object rotation.',
    concept: 'A large compass with a ghost north needle, solid east needle and clockwise turn arc.',
    svg: coordinateTurn(),
    labels: [],
  },
  'spatial-grid-nav': {
    domain: 'spatial',
    mechanic: 'Follow forward, back and relative turn commands inside a bounded square grid.',
    interaction: 'Trace the marker mentally, then choose the small board marking its final cell.',
    object: 'A contiguous elbow route from hollow start to directional destination.',
    distinction: 'The visible start-to-end route dominates a bounded board; no disconnected memory cells.',
    concept: 'A five-by-five navigation board carries one bold continuous two-turn route.',
    svg: gridNavigator(),
    labels: [],
  },
  'spatial-transform-match': {
    domain: 'spatial',
    mechanic: 'Memorize a briefly shown pattern, then infer and select the correct rotated or mirrored result.',
    interaction: 'Recall the hidden source pattern and tap its correct transformed candidate.',
    object: 'Equal-size pattern panels on opposite sides of a mirror axis.',
    distinction: 'Fixed board size and preserved cell count separate reflection from shrinking OR-folds.',
    concept: 'Two sparse asymmetric patterns reflect exactly across a visible vertical mirror axis.',
    svg: transformMatch(),
    labels: [],
  },
  'flexibility-card-sort': {
    domain: 'flexibility',
    mechanic: 'Match a target by color or shape across rule blocks, including hidden-rule discovery stretches.',
    interaction: 'Pick one of four cards under the active sorting rule and adapt after notice of a switch.',
    object: 'A target card above a fan of four candidates, with one shape match lifted.',
    distinction: 'Physical card sorting with two attributes and rule-switch notice; there are no number attributes.',
    concept: 'An oversized triangle card sorts to a lifted triangle in a four-card fan with color lures.',
    svg: cardSort(),
    labels: [],
  },
  'flexibility-color-stroop': {
    domain: 'flexibility',
    mechanic: 'Resolve conflicting word meaning and ink color according to the current ink-or-word rule.',
    interaction: 'Read the active rule, then select the appropriate color answer.',
    object: 'The native word RED printed in blue ink, with a blue answer selected.',
    distinction: 'Semantic word-versus-ink conflict, not card attributes or a plain color swatch match.',
    concept: 'A large color word conflicts with its ink; a curved arrow selects the ink-color answer.',
    svg: colorStroop(),
    labels: [label(160, 82, 'RED', 49, '#326FDA'), label(86, 155, 'RED', 22, '#6B2330'), label(233, 155, 'BLUE', 22, PAPER)],
  },
  'flexibility-cue-shift': {
    domain: 'flexibility',
    mechanic: 'An explicit trial cue selects color, shape or number as the target-matching rule.',
    interaction: 'Read each cue and select the candidate matching only the named attribute.',
    object: 'Three attribute selectors above two cards whose shape matches but color and number disagree.',
    distinction: 'The explicit attribute selector is the subject; the rule may repeat but is cued each trial.',
    concept: 'A shape cue selects matching triangles while native numbers and colors disagree.',
    svg: cueShift(),
    labels: [label(209, 47, '#', 25, PURPLE_EDGE), label(94, 134, '3', 24, PAPER), label(226, 134, '7', 24, INK)],
  },
  'flexibility-rule-flip': {
    domain: 'flexibility',
    mechanic: 'Maintain a color, shape or number rule across a run of trials, then adapt to block flips and uncued stretches.',
    interaction: 'Match the target to one candidate, retaining or inferring the rule until it changes.',
    object: 'A hinged physical rule tile turns from shape to number.',
    distinction: 'A sustained rule flips at a block boundary; unlike Cue Shift, rule persistence and inference matter.',
    concept: 'A large raised shape face pivots over the number-rule face with a single flip arrow.',
    svg: ruleFlip(),
    labels: [label(160, 132, '#', 43, PAPER)],
  },
  'flexibility-task-switch': {
    domain: 'flexibility',
    mechanic: 'Apply a cued parity, low/high magnitude or color classification to one number-bearing token.',
    interaction: 'Read the micro-task cue and select the correct verbal classification.',
    object: 'One number token branches to ODD and HIGH task answers.',
    distinction: 'Classify a single token under different tasks, rather than matching target and candidate cards.',
    concept: 'A large seven has two task branches showing its parity and magnitude classifications.',
    svg: taskSwitch(),
    labels: [label(160, 66, '7', 43, PAPER), label(91, 156, 'ODD', 23, PURPLE_EDGE), label(229, 156, 'HIGH', 23, PURPLE_EDGE)],
  },
};
