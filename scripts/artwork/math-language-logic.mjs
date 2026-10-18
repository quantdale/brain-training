/** Mechanic-first Math, Language and Logic art; labels are native overlays. */
import {
  INK, PAPER, PIGMENTS, arrow, circle, disc, label, line, path, rect, scene, symbol, tile,
} from './primitives.mjs';

/** Opaque narrow paper edging preserves action cues on both app themes. */
function edgedArrow(x1, y1, x2, y2, color, width = 4) {
  return arrow(x1, y1, x2, y2, PAPER, width + 3)
    + arrow(x1, y1, x2, y2, color, width);
}

function edgedPath(d, color, width = 3) {
  return path(d, 'none', PAPER, width + 3)
    + path(d, 'none', color, width);
}

function equationBuilder() {
  const [blue, pale, deep] = PIGMENTS.math;
  return scene(
    disc(160, 49, 27, blue)
    + arrow(160, 109, 160, 84, deep, 4)
    + tile(30, 113, 260, 55, pale, 13)
    + tile(38, 118, 49, 43, PAPER, 9)
    + tile(135, 118, 49, 43, PAPER, 9)
    + tile(233, 118, 49, 43, PAPER, 9),
    [
      label(160, 47, '12', 32, PAPER),
      label(62, 138, '3', 30), label(111, 138, '+', 27, deep),
      label(160, 138, '4', 30), label(209, 138, '+', 27, deep),
      label(257, 138, '5', 30),
    ],
  );
}

function fastMath() {
  const [blue, pale, deep] = PIGMENTS.math;
  let svg = tile(76, 24, 168, 150, blue, 18)
    + rect(89, 38, 142, 54, PAPER, 9);
  const labels = [label(160, 64, '7 + 5 = ?', 27)];
  [1, 2, 3, 4, 5, 6].forEach((value, index) => {
    const x = 89 + (index % 3) * 50;
    const y = 105 + Math.floor(index / 3) * 34;
    svg += tile(x, y, 42, 25, index === 1 ? pale : PAPER, 6);
    labels.push(label(x + 21, y + 11, String(value), 20, deep));
  });
  // A small stopwatch is subordinate to the calculator's answer-entry face.
  svg += rect(248, 28, 13, 8, deep, 3)
    + disc(254, 59, 25, PAPER)
    + circle(254, 59, 20, pale)
    + line(254, 59, 254, 44, deep, 3)
    + line(254, 59, 265, 63, deep, 3);
  return scene(svg, labels);
}

function missingOperator() {
  const [blue, pale, deep] = PIGMENTS.math;
  const svg = tile(22, 51, 276, 76, PAPER, 15)
    + rect(75, 60, 48, 56, pale, 9, `stroke="${deep}" stroke-width="2" stroke-dasharray="5 5"`)
    + arrow(99, 140, 99, 120, deep, 3)
    + tile(75, 141, 48, 35, blue, 9);
  return scene(svg, [
    label(48, 88, '8', 34),
    label(99, 88, '?', 30, deep),
    label(149, 88, '2', 34),
    label(184, 88, '=', 28),
    label(247, 88, '16', 34),
    label(99, 157, '×', 29, PAPER),
  ]);
}

function wordChain() {
  const [cyan, pale, deep] = PIGMENTS.language;
  // The final letter feeds the next word's first letter. A descending chain
  // silhouette keeps this separate from a sentence's single assembly rail.
  const svg = path('M109 51 Q150 51 150 73', 'none', deep, 4)
    + arrow(150, 66, 150, 74, deep, 3)
    + path('M210 102 Q251 102 251 124', 'none', deep, 4)
    + arrow(251, 117, 251, 125, deep, 3)
    + tile(22, 27, 88, 46, PAPER, 11)
    + tile(116, 78, 94, 46, pale, 11)
    + tile(201, 129, 98, 46, PAPER, 11)
    + rect(80, 61, 16, 4, cyan, 2)
    + rect(127, 112, 16, 4, cyan, 2)
    + rect(182, 112, 16, 4, deep, 2)
    + rect(209, 163, 15, 4, deep, 2);
  return scene(svg, [
    label(66, 48, 'CAT', 26, INK),
    label(163, 99, 'TREE', 24, deep),
    label(250, 150, 'EAGLE', 22, INK),
  ]);
}

function numberLine() {
  const [blue, pale, deep] = PIGMENTS.math;
  let svg = tile(25, 93, 270, 42, pale, 8)
    + line(43, 103, 278, 103, deep, 3);
  for (let index = 0; index <= 10; index += 1) {
    const x = 43 + index * 23.5;
    svg += line(x, 103, x, index % 5 === 0 ? 124 : 116, deep, index % 5 === 0 ? 3 : 2);
  }
  svg += tile(105, 25, 65, 39, blue, 9)
    + path('M127 79 L137 96 L147 79Z', deep, deep, 2)
    + circle(137, 77, 13, PAPER, `stroke="${deep}" stroke-width="3"`)
    + tile(28, 137, 31, 29, PAPER, 6)
    + tile(249, 137, 50, 29, PAPER, 6)
    + edgedArrow(111, 165, 166, 165, deep, 3);
  return scene(svg, [
    label(137, 43, '40', 28, PAPER),
    label(43, 150, '0', 22, deep), label(278, 150, '100', 22, deep),
  ]);
}

function valueOrder() {
  const [blue, pale, deep] = PIGMENTS.math;
  return scene(
    tile(32, 127, 66, 45, pale, 10)
    + tile(119, 91, 82, 81, blue, 10)
    + tile(222, 49, 66, 123, deep, 10)
    + edgedArrow(48, 107, 263, 27, deep, 4),
    [
      label(65, 148, '3', 31, deep),
      label(160, 129, '2 × 4', 25, PAPER),
      label(255, 89, '12', 33, PAPER),
    ],
  );
}

function contextFit() {
  const [cyan, pale, deep] = PIGMENTS.language;
  return scene(
    tile(29, 22, 249, 101, PAPER, 13)
    + rect(115, 76, 118, 38, pale, 7, `stroke="${deep}" stroke-width="2" stroke-dasharray="5 5"`)
    + arrow(219, 132, 196, 119, deep, 3)
    + tile(172, 135, 105, 39, cyan, 9),
    [
      label(140, 47, 'Birds build', 27),
      label(74, 94, 'their', 26),
      label(174, 94, '?', 28, deep),
      label(224, 153, 'nests', 25, PAPER),
    ],
  );
}

function sentenceBuilder() {
  const [cyan, pale, deep] = PIGMENTS.language;
  return scene(
    tile(29, 28, 66, 43, PAPER, 9)
    + tile(111, 28, 93, 43, pale, 9)
    + tile(222, 28, 69, 43, PAPER, 9)
    // Complete before/after rows show whole-sentence reordering, rather than
    // another single-word gap. Crossing routes move two shuffled word chips.
    + edgedPath('M62 80 C62 107 253 85 253 116', deep, 3)
    + edgedArrow(253, 109, 253, 118, deep, 3)
    + edgedPath('M156 80 Q107 86 77 116', deep, 3)
    + edgedArrow(84, 109, 77, 117, deep, 3)
    + rect(23, 122, 274, 54, pale, 12)
    + tile(27, 125, 91, 44, cyan, 9)
    + tile(133, 125, 66, 44, cyan, 9)
    + tile(214, 125, 77, 44, cyan, 9),
    [
      label(62, 48, 'fly', 25), label(157, 48, 'Birds', 25, deep), label(256, 48, 'can', 25),
      label(72, 145, 'Birds', 25, PAPER), label(166, 145, 'can', 25, PAPER),
      label(252, 145, 'fly', 25, PAPER),
    ],
  );
}

function wordMatch() {
  const [cyan, pale, deep] = PIGMENTS.language;
  return scene(
    path('M47 120 L33 150 L77 122Z', pale, pale, 1)
    + path('M244 122 L281 150 L267 120Z', cyan, cyan, 1)
    + tile(22, 54, 123, 75, pale, 18)
    + tile(175, 54, 123, 75, cyan, 18),
    [
      label(83, 89, 'happy', 27, deep), label(160, 89, '=', 28, deep),
      label(236, 89, 'glad', 29, PAPER),
    ],
  );
}

function wordScramble() {
  const [cyan, pale, deep] = PIGMENTS.language;
  const letters = [
    { x: 29, y: 35, text: 'V' }, { x: 83, y: 49, text: 'R' },
    { x: 138, y: 29, text: 'R' }, { x: 193, y: 48, text: 'E' },
    { x: 247, y: 36, text: 'I' },
  ];
  return scene(
    letters.map(({ x, y }, index) => tile(x, y, 44, 47, index % 2 ? pale : PAPER, 8)).join('')
    + arrow(160, 100, 160, 117, deep, 4)
    + tile(82, 128, 156, 44, cyan, 10),
    [
      ...letters.map(({ x, y, text }) => label(x + 22, y + 22, text, 28, deep)),
      label(160, 148, 'RIVER', 29, PAPER),
    ],
  );
}

function codeCracker() {
  const [teal, pale, deep] = PIGMENTS.logic;
  let svg = tile(25, 28, 270, 145, pale, 17)
    + rect(47, 43, 185, 36, deep, 9);
  const colors = ['#E87837', '#4D8DE4', '#E5AE23', teal];
  colors.forEach((color, index) => {
    const x = 62 + index * 46;
    svg += circle(x + 8, 61, 8, PAPER, 'opacity=".3"')
      + disc(x, 119, 16, color);
  });
  svg += circle(253, 106, 7, deep)
    + circle(274, 106, 7, PAPER, `stroke="${deep}" stroke-width="2"`)
    + circle(253, 130, 7, pale, `stroke="${deep}" stroke-width="1" opacity=".3"`)
    + circle(274, 130, 7, pale, `stroke="${deep}" stroke-width="1" opacity=".3"`);
  return scene(svg);
}

function cup(x, y, color) {
  return path(`M${x - 8} ${y - 8} H${x + 6} V${y + 4} Q${x + 6} ${y + 10} ${x - 1} ${y + 10} Q${x - 8} ${y + 10} ${x - 8} ${y + 4}Z`, 'none', color, 2.5)
    + path(`M${x + 6} ${y - 5} Q${x + 17} ${y - 5} ${x + 11} ${y + 4} H${x + 6}`, 'none', color, 2.5);
}

function deductionTable() {
  const [teal, pale, deep] = PIGMENTS.logic;
  let svg = tile(25, 25, 193, 149, PAPER, 11)
    + rect(28, 28, 187, 33, pale, 8)
    + line(73, 29, 73, 168, deep, 1.5)
    + line(143, 29, 143, 168, deep, 1.5)
    + symbol('triangle', 109, 45, 19, deep)
    + cup(175, 43, deep);
  [62, 98, 134].forEach((y) => { svg += line(29, y, 214, y, deep, 1.5); });
  svg += rect(147, 138, 66, 31, teal, 5)
    + tile(221, 65, 76, 78, pale, 10)
    + symbol('triangle', 258, 117, 22, deep)
    + line(244, 127, 272, 104, deep, 3);
  return scene(svg, [
    label(50, 79, 'A', 23, deep), label(50, 115, 'B', 23, deep), label(50, 151, 'C', 23, deep),
    label(109, 79, '?', 23, deep), label(179, 79, '?', 23, deep),
    label(109, 115, '?', 23, deep), label(179, 115, '?', 23, deep),
    label(109, 151, '?', 23, deep), label(179, 151, '?', 26, PAPER),
    label(258, 84, 'A', 24, deep),
  ]);
}

function nextSequence() {
  const [teal, , deep] = PIGMENTS.logic;
  let svg = '';
  for (let index = 0; index < 3; index += 1) {
    const x = 47.5 + index * 75;
    svg += edgedPath(`M${x} 69 Q${x + 37.5} 21 ${x + 75} 69`, deep, 3)
      + edgedArrow(x + 69, 60, x + 75, 69, deep, 3);
  }
  const values = ['2', '4', '8', '?'];
  values.forEach((_, index) => { svg += tile(20 + index * 75, 80, 55, 62, index === 3 ? teal : PAPER, 11); });
  return scene(svg, values.map((value, index) => label(47.5 + index * 75, 108, value, 34, index === 3 ? PAPER : deep)));
}

function orderPath() {
  const [teal, pale, deep] = PIGMENTS.logic;
  const svg = edgedArrow(88, 60, 134, 84, deep, 4)
    + edgedArrow(186, 85, 232, 61, deep, 4)
    + disc(64, 48, 24, PAPER)
    + disc(160, 99, 24, pale)
    + disc(257, 48, 24, PAPER)
    + tile(43, 143, 66, 31, PAPER, 7)
    + tile(127, 143, 66, 31, pale, 7)
    + tile(211, 143, 66, 31, teal, 7);
  return scene(svg, [
    label(64, 46, 'A', 29, deep), label(160, 97, 'B', 29, deep), label(257, 46, 'C', 29, deep),
    label(76, 157, 'A', 23, deep), label(160, 157, 'B', 23, deep), label(244, 157, '?', 25, PAPER),
  ]);
}

function ruleGrid() {
  const [teal, pale, deep] = PIGMENTS.logic;
  // A true 3×3 Latin square: its center must be 3 because both crossing
  // constraints contain 1 and 2. This grid carries a real deduction.
  const values = [[1, 2, 3], [2, '?', 1], [3, 1, 2]];
  let svg = rect(69, 75, 184, 51, pale, 9)
    + rect(135, 23, 50, 153, pale, 9);
  const labels = [];
  values.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
    const x = 77 + colIndex * 59;
    const y = 25 + rowIndex * 51;
    const asked = rowIndex === 1 && colIndex === 1;
    svg += tile(x, y, 48, 44, asked ? teal : PAPER, 7);
    labels.push(label(x + 24, y + 20, String(value), asked ? 32 : 28, asked ? PAPER : deep));
  }));
  return scene(svg, labels);
}

function identity(domain, concept, mechanic, interaction, object, distinction, artwork) {
  return { domain, concept, mechanic, interaction, object, distinction, ...artwork };
}

export const SCENES = {
  'math-equation-builder': identity('math',
    'Assemble 3 + 4 + 5 on a construction rail to reach the separate target 12.',
    'Construct an expression using every given number to reach a target, respecting precedence and optional grouping.',
    'Tap supplied number and operator pieces, then submit the constructed equation.',
    'Number pieces on an expression rail beneath a target medallion.',
    'Builds the expression itself; Fast Math supplies the expression and Missing Operator omits only an operator.', equationBuilder()),
  'math-fast-math': identity('math',
    'A calculator face presents 7 + 5 = ? above number-entry keys, accompanied by a small stopwatch.',
    'Solve validated exact arithmetic against a round budget.',
    'Type the numeric answer on a number pad and submit.',
    'Calculator display and keypad with a subordinate timing dial.',
    'Produces the numerical answer to a supplied expression rather than selecting a symbol or arranging values.', fastMath()),
  'math-missing-operator': identity('math',
    'Choose the multiplication tile that fills the operator gap in 8 × 2 = 16.',
    'Find the unique operator that makes a fixed equation true.',
    'Tap one of the four operator choices.',
    'An operator-shaped gap with an incoming multiplication tile.',
    'Only the operator is unknown; all operands and the result are supplied.', missingOperator()),
  'math-number-line-estimation': identity('math',
    'Place a movable marker for 40 on a calibrated 0–100 ruler.',
    'Estimate a target number’s continuous position between labeled endpoints.',
    'Tap or adjust a draft position, then submit the estimate.',
    'Horizontal calibrated ruler and movable position marker.',
    'Continuous spatial interpolation rather than discrete ranking of tiles.', numberLine()),
  'math-value-ordering': identity('math',
    'Ascending magnitude steps read 3, 2 × 4, and 12 under a rising ordering arrow.',
    'Rank a shuffled set of distinct numeric values, including expression-disguised values.',
    'Tap every tile from smallest value to largest; a wrong tap ends the round.',
    'A magnitude staircase with an expression-valued middle block.',
    'Expression evaluation plus relative magnitude, unlike Speed’s ordinary number sweep.', valueOrder()),
  'language-context-fit': identity('language',
    'A sentence sheet says Birds build their ? while a nests word card approaches the blank.',
    'Select the one word best completing a sentence’s meaning.',
    'Read the sentence and tap the fitting word option.',
    'Sentence sheet with a word-shaped blank and a semantically fitting word card.',
    'Fills a contextual sentence gap; Sentence Builder instead orders all word chips.', contextFit()),
  'language-sentence-builder': identity('language',
    'Multiple shuffled whole-word chips fly, Birds, can reorder into the complete Birds can fly sentence rail.',
    'Reconstruct a scrambled sentence in a valid grammatical word order.',
    'Tap full-word chips in sequence under a category hint and round timer.',
    'Separate whole-word chips on a sentence assembly rail.',
    'Orders words, whereas Word Scramble recognizes an unscrambled single word from letters.', sentenceBuilder()),
  'language-word-chain': identity('language',
    'Follow CAT → TREE → EAGLE, joining each final letter to the next initial letter.',
    'Complete missing lexical links where the next word begins with the previous word’s last letter.',
    'Select successive missing word options in a chain.',
    'Descending word cards joined by directional links and matching endpoint-letter accents.',
    'Uses spelling endpoints rather than semantic synonyms or sentence grammar.', wordChain()),
  'language-word-match': identity('language',
    'Two facing speech bubbles pair happy and glad across an equivalence sign.',
    'Recognize the best synonym of a prompt word among four options.',
    'Tap the word with the same meaning before the deadline.',
    'Two matching-meaning speech bubbles.',
    'Semantic equivalence rather than identical spelling, anagram formation, or terminal-letter chains.', wordMatch()),
  'language-word-scramble': identity('language',
    'Loose V R R E I letter pieces resolve to one intact RIVER word-choice card.',
    'Recognize the word represented by a letter scramble using a category hint.',
    'Select an unscrambled word option and submit; rounds are untimed.',
    'Scattered individual letters above one resolved word card.',
    'Letters within one word, not whole-word sentence ordering; the player selects rather than drags letters.', wordScramble()),
  'logic-code-cracker': identity('logic',
    'A concealed four-peg code sits above a colored guess and filled versus outline feedback pegs.',
    'Deduce a hidden color code from exact-position and color-only feedback after guesses.',
    'Build a color guess and submit, then use feedback to refine the next guess.',
    'Code pegboard with a concealed row, a guess row, and a separate feedback cluster.',
    'Logical feedback-driven code deduction rather than memorizing or directly matching colors.', codeCracker()),
  'logic-deduction-table': identity('logic',
    'A labeled entity-by-attribute table carries one asked cell and an attached A-not-triangle clue slip.',
    'Use equality, exclusion and inequality clues to infer one uniquely determined entity attribute.',
    'Read the table and clues, then choose the asked value.',
    'A row-labeled dossier table with pictorial attribute headers and a clue slip.',
    'Entity attributes and external clues; Rule Grid instead applies one Latin row/column rule.', deductionTable()),
  'logic-next-sequence': identity('logic',
    'A numeric progression 2, 4, 8, ? follows repeated curved continuation arrows.',
    'Infer a numerical pattern and choose its next term.',
    'Inspect the visible terms and tap the correct continuation.',
    'Ordered number tokens ending in a conspicuous unknown.',
    'Infers an unseen rule rather than recalling shown order or ranking magnitudes.', nextSequence()),
  'logic-order-path': identity('logic',
    'Directed A → B → C precedence nodes feed an ordered A, B, ? slot rail.',
    'Solve a uniquely ordered precedence puzzle from before/after constraints.',
    'Tap each lettered item in the only valid order.',
    'Lettered precedence graph and ordered placement slots.',
    'Topological order of letters, not spatial navigation or numerical continuation.', orderPath()),
  'logic-rule-grid': identity('logic',
    'A valid 3×3 Latin grid highlights the row and column that force its central missing 3.',
    'Deduce an asked Latin-square cell; each row and column contains every symbol once, with chained unknowns on harder levels.',
    'Inspect the grid and tap the only symbol fitting the asked cell.',
    'Latin numeral board with one targeted blank and intersecting constraint bands.',
    'Constraint-based symbol deduction, not memory pattern recall or entity-attribute clues.', ruleGrid()),
};
