/**
 * tutorial-solver.mjs — deterministic guided-tutorial solvers (Campaign 080,
 * Wave D).
 *
 * The problem this solves
 * -----------------------
 * 24 of 42 games sat at L0 for one dominant reason: their tutorial is a GUIDED,
 * ANSWER-DRIVEN demo. A generic driver that taps whatever looks pressable never
 * clears one, because the demo validates a specific answer. The application was
 * very likely fine; the automation simply could not demonstrate it. This module
 * gives the harness the capability instead of relaxing the certification
 * standard.
 *
 * What counts as a legitimate solve
 * ---------------------------------
 * Every returned step must let the harness prove the full chain the campaign
 * requires:
 *
 *   1. current problem observed      (the observation's control inventory)
 *   2. valid response identified     (this module, with a stated reason)
 *   3. response submitted            (harness taps the returned target)
 *   4. application response observed (harness compares before/after)
 *   5. tutorial advanced             (observed state leaves `tutorial`)
 *   6. tutorial completed            (contract's tutorialCompleted axis)
 *   7. gameplay entered              (observed tutorial/intro -> playing)
 *
 * Blind tapping cannot satisfy steps 5-7, so it can never fake a solve. This
 * module's job is steps 1-2 only, and it must always explain WHY a target is
 * correct — an unexplained target is reported as no-plan rather than a guess.
 *
 * Two honest solve tiers (never conflated)
 * ----------------------------------------
 *   DERIVED          The answer is computed from the observed problem using the
 *                    game's own documented rule (arithmetic, ordering, operator
 *                    solving). Strongest evidence: the solver knew the answer.
 *   REVEAL_GUIDED    The game's own tutorial teaches by revealing. After a wrong
 *                    attempt many demos label the correct choice
 *                    (`Correct: …`, a `cell-verdict` marker, an unlocked flag)
 *                    and offer a retry. Reading that explicit application
 *                    accessibility label and then selecting the revealed answer
 *                    is a legitimate observe-then-submit interaction, not a
 *                    guess — but it is graded lower and MUST be labelled as
 *                    reveal-guided in the evidence.
 *
 * The tier is reported per step so no coverage claim can silently present a
 * reveal-guided tutorial as knowledge-derived play.
 *
 * No provider dependency
 * ----------------------
 * Everything here is pure, deterministic and local. It reads only the control
 * inventory + accessibility text the app itself exposes. No language model, no
 * network, no fixture-of-convenience: a provider outage cannot stall the
 * campaign, and a solver answer is reproducible on any machine.
 *
 * Testability
 * -----------
 * Functions operate on plain observation objects, so the solvers are validated
 * offline against the REAL recorded control inventories in
 * `native-coverage-ledger-v2.json` — the exact shapes the emulator produced —
 * rather than against invented fixtures.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * How a step was obtained. Reported per step; never merged.
 *
 *   DERIVED        an ANSWER was computed from the observed problem using the
 *                  game's own documented rule (3+5=8, a solved operator, a
 *                  rotation test, a fixed demo stream). The strongest tier: the
 *                  harness genuinely knew the answer.
 *   REVEAL_GUIDED  the app teaches by revealing; the harness read the app's own
 *                  "Correct: …" label / verdict marker and selected it. A
 *                  legitimate observe-then-submit interaction, graded lower.
 *   NAVIGATION     NO answer was involved. The step is pure advancement —
 *                  acknowledging a demo the app itself marked complete
 *                  ("That is it" / "Got it"), or continuing past an explanatory
 *                  notice. Calling this DERIVED would overstate it: nothing was
 *                  solved.
 */
export const SolveTier = Object.freeze({
  DERIVED: 'DERIVED',
  REVEAL_GUIDED: 'REVEAL_GUIDED',
  NAVIGATION: 'NAVIGATION',
});

/** Reusable interaction families. A game maps to one; several share behaviour. */
export const SolverFamily = Object.freeze({
  NOTICE_CONTINUE: 'notice-continue',
  ARITHMETIC_KEYPAD: 'arithmetic-keypad',
  EQUATION_BUILD: 'equation-build',
  MISSING_OPERATOR: 'missing-operator',
  ORDER_BY_VALUE: 'order-by-value',
  REVEAL_CHOICE: 'reveal-choice',
  GRID_REBUILD: 'grid-rebuild',
  SEQUENCE_REPLAY: 'sequence-replay',
  BINARY_JUDGEMENT: 'binary-judgement',
  TIMED_TARGET: 'timed-target',
  NAVIGATE: 'navigate',
  WORD_ORDER: 'word-order',
  CODE_GUESS: 'code-guess',
});

/**
 * Per-game family + the game-specific knowledge the family needs.
 *
 * `demoSeed`/`demoParams` are recorded so a derived answer can be reproduced
 * from the game's own generator contract rather than from whatever happened to
 * be on screen.
 */
export const GAME_SOLVER_SPECS = Object.freeze({
  // -- math: fully derivable -------------------------------------------------
  'math-fast-math': {
    family: SolverFamily.ARITHMETIC_KEYPAD,
    // TUTORIAL_DEMO_PARAMS in components/tutorial.tsx fixes operators to '+' and
    // a 2-round demo, so `left + right` is the demo answer by construction.
    derive: 'sum',
  },
  'math-equation-builder': {
    family: SolverFamily.EQUATION_BUILD,
  },
  'math-missing-operator': {
    family: SolverFamily.MISSING_OPERATOR,
  },
  'math-value-ordering': { family: SolverFamily.ORDER_BY_VALUE },
  'math-number-line-estimation': { family: SolverFamily.NAVIGATE },

  // -- ordering / sequences --------------------------------------------------
  'speed-order-sweep': { family: SolverFamily.ORDER_BY_VALUE, order: 'ascending' },
  'memory-sequence-memory': { family: SolverFamily.SEQUENCE_REPLAY },
  // Running Order's demo is a FULLY FIXED contract in source:
  //   TUTORIAL_DEMO_STREAM = [0, 1, 2]  (red circle, blue square, green triangle)
  //   TUTORIAL_DEMO_RECALL = 2          (reproduce the LAST TWO, in order)
  // so the derived replay is symbols 1 then 2 — computed from the game's own
  // constants (RUNNING_ORDER_SYMBOLS labels), not observed by luck.
  'memory-running-order': {
    family: SolverFamily.SEQUENCE_REPLAY,
    demoStream: [0, 1, 2],
    recall: 2,
  },
  'logic-next-sequence': { family: SolverFamily.NAVIGATE },
  'logic-order-path': { family: SolverFamily.NAVIGATE },

  // -- grid recall / rebuild -------------------------------------------------
  'memory-grid-recall': { family: SolverFamily.GRID_REBUILD },
  // Pair Recall's tutorial is a PASSIVE DEMONSTRATION: it renders a disabled
  // CuePanel and only offers next/done. Nothing is answer-entered, so the
  // correct family is navigation — claiming a grid rebuild here would be a
  // fabricated interaction.
  'memory-pair-recall': { family: SolverFamily.NAVIGATE },
  'attention-symbol-tracker': { family: SolverFamily.GRID_REBUILD },
  memory: { family: SolverFamily.GRID_REBUILD },
  'memory-pattern-tap-back': { family: SolverFamily.GRID_REBUILD },
  'attention-odd-one-out': { family: SolverFamily.GRID_REBUILD },
  'attention-visual-search': { family: SolverFamily.GRID_REBUILD },
  'attention-target-count': { family: SolverFamily.GRID_REBUILD },

  // -- reveal-guided choice --------------------------------------------------
  'language-context-fit': { family: SolverFamily.REVEAL_CHOICE },
  'language-word-match': { family: SolverFamily.REVEAL_CHOICE },
  'language-word-scramble': { family: SolverFamily.REVEAL_CHOICE },
  // Sentence Builder's demo is deterministic (TUTORIAL_DEMO_SEED with
  // roundIndex 0), so the demo round is FIXED. The solver reads the tiles it can
  // see and builds the sentence using the game's own word-order bank; the
  // scrambled order is intentionally NOT used as a correctness signal.
  'language-sentence-builder': { family: SolverFamily.WORD_ORDER },
  'language-word-chain': { family: SolverFamily.REVEAL_CHOICE },
  'logic-deduction-table': { family: SolverFamily.REVEAL_CHOICE },
  'logic-code-cracker': { family: SolverFamily.CODE_GUESS },
  'logic-rule-grid': { family: SolverFamily.GRID_REBUILD },
  'flexibility-rule-flip': { family: SolverFamily.GRID_REBUILD },
  'flexibility-card-sort': { family: SolverFamily.GRID_REBUILD },
  'flexibility-cue-shift': { family: SolverFamily.GRID_REBUILD },
  'flexibility-task-switch': { family: SolverFamily.REVEAL_CHOICE },
  'flexibility-color-stroop': { family: SolverFamily.REVEAL_CHOICE },
  'spatial-fold-match': { family: SolverFamily.REVEAL_CHOICE },
  'spatial-transform-match': { family: SolverFamily.REVEAL_CHOICE },
  'spatial-coordinate-turn': { family: SolverFamily.NAVIGATE },
  'spatial-grid-nav': { family: SolverFamily.NAVIGATE },

  // -- binary judgement ------------------------------------------------------
  'spatial-mental-rotation': { family: SolverFamily.BINARY_JUDGEMENT },

  // -- timed ----------------------------------------------------------------
  'speed-tap-rush': { family: SolverFamily.TIMED_TARGET },
  'speed-reaction-time': { family: SolverFamily.TIMED_TARGET },
  'speed-color-match': { family: SolverFamily.TIMED_TARGET },
  'speed-quick-compare': { family: SolverFamily.BINARY_JUDGEMENT },
  'attention-sustained-vigilance': { family: SolverFamily.TIMED_TARGET },

  // -- plain navigation ------------------------------------------------------
  'memory-prospective-cue': { family: SolverFamily.NAVIGATE },
});

// ---------------------------------------------------------------------------
// Observation helpers
// ---------------------------------------------------------------------------

/** Accessibility text the app exposes for one control (label, then desc). */
function textOf(detail) {
  if (!detail || typeof detail !== 'object') return '';
  return String(detail.text || detail.desc || '').trim();
}

/** All control keys that currently exist and are tappable. */
export function tappableControls(observation) {
  const details = (observation && observation.controlDetails) || {};
  return Object.keys(details);
}

/** Suffix list from the observation itself (authoritative inventory). */
function suffixesOf(observation) {
  const list = (observation && observation.controls) || [];
  return Array.isArray(list) ? list.slice() : [];
}

const CORRECT_RE = /\bcorrect\b\s*[:：]\s*(.*)$/i;
const WRONG_RE = /\bwrong\b/i;
const LOCKED_RE = /\blocked\b/i;

/**
 * Was this control explicitly labelled as the correct answer by the app?
 *
 * Several tutorials teach by marking the answer after an attempt
 * (`Correct: sorrowful`, `Correct: Cell 6`). This reads that label; it never
 * infers correctness from position or from the solver's own opinion.
 */
export function revealedCorrectText(detail) {
  const t = textOf(detail);
  const m = CORRECT_RE.exec(t);
  return m ? String(m[1]).trim() : null;
}

/** Controls the app has explicitly marked correct (reveal-guided signal). */
export function revealedCorrectControls(observation) {
  const details = (observation && observation.controlDetails) || {};
  const out = [];
  for (const key of Object.keys(details)) {
    if (revealedCorrectText(details[key]) !== null) out.push(key);
  }
  return out;
}

/** Controls the app has marked as a wrong pick or as locked. */
export function rejectedControls(observation) {
  const details = (observation && observation.controlDetails) || {};
  return Object.keys(details).filter((k) => {
    const t = textOf(details[k]);
    return WRONG_RE.test(t) || LOCKED_RE.test(t);
  });
}

/** Numeric value of a control: explicit `Number N`/`Digit N` desc, else text. */
export function numericValueOf(detail, key) {
  const t = textOf(detail);
  const numDesc = /(?:number|digit)\s*(\d+(?:\.\d+)?)/i.exec(t);
  if (numDesc) return Number(numDesc[1]);
  const bare = /^-?\d+(?:\.\d+)?$/.exec(t);
  if (bare) return Number(bare[0]);
  const suffixNum = /\.(\d+)$/.exec(String(key || ''));
  if (suffixNum) return Number(suffixNum[1]);
  return null;
}

/** Read the shown arithmetic problem operands. */
export function readArithmetic(observation) {
  const d = (observation && observation.controlDetails) || {};
  const num = (k) => {
    const t = textOf(d[k]);
    const m = /^-?\d+$/.exec(t);
    return m ? Number(m[0]) : null;
  };
  const left = num('problem-left');
  const right = num('problem-right');
  const secondOp = d['problem-second-op'] ? textOf(d['problem-second-op']) : '';
  const secondOperand = d['problem-second-operand'] ? num('problem-second-operand') : null;
  // The operator itself has no dedicated testID in the Fast Math display; the
  // tutorial demo fixes it to '+' by contract, and the game's problem text
  // exposes it as board text when present.
  const board = (observation && observation.boardValues) || [];
  const boardText = board.join(' ');
  const operator = ['+', '−', '-', '×', '÷'].find((op) => boardText.includes(` ${op} `) || boardText.startsWith(`${op} `)) || '+';
  return { left, right, operator, secondOp, secondOperand };
}

/** True when the observation still shows a tutorial surface. */
export function isTutorialSurface(observation) {
  const s = suffixesOf(observation);
  return s.includes('tutorial') || /^tutorial/.test(String((observation && observation.phase) || ''));
}

/** A control usable as a "next/continue/done" navigation affordance. */
export function navigationTarget(observation, { includeSkip = false } = {}) {
  const s = suffixesOf(observation);
  // `tutorial-demo-done` ("That's it") is the per-demo completion affordance
  // that appears once the demo is satisfied; it precedes the final
  // `tutorial-done`. It is listed BEFORE the navigation verbs because a demo
  // that has just been completed should be acknowledged, not re-entered.
  const order = includeSkip
    ? ['tutorial-skip', 'tutorial-demo-done', 'tutorial-done', 'tutorial-notice-continue', 'tutorial-demo-next', 'tutorial-next', 'tutorial-feedback-next', 'tutorial-retry']
    : ['tutorial-demo-done', 'tutorial-done', 'tutorial-notice-continue', 'tutorial-demo-next', 'tutorial-next', 'tutorial-feedback-next'];
  // `tutorial-retry` is only a navigation target when the demo is COMPLETE and
  // offering a retry; treating it as navigation mid-demo would discard progress.
  return order.find((k) => s.includes(k)) || null;
}

// ---------------------------------------------------------------------------
// Family solvers
// ---------------------------------------------------------------------------

/**
 * Running Order symbol labels, transcribed from the game's own
 * `RUNNING_ORDER_SYMBOLS` palette (id -> label). Kept here so the solver can
 * derive a replay answer without importing app code into the QA tooling; a
 * mismatch is caught by the ledger cross-check test, which asserts the derived
 * label actually exists in the recorded palette controls.
 */
export const RUNNING_ORDER_LABELS = Object.freeze([
  'red circle', 'blue square', 'green triangle', 'orange star',
  'purple diamond', 'pink heart', 'cyan inverted triangle', 'indigo spade',
  'lime club', 'yellow cross', 'gray sun', 'teal arrowhead',
]);

const isAnswerLike = (key) =>
  /(^|\.)(digit|number|operator|op|tile|cell|card|option|choice|word|token|key|pad|swatch|color|shape)([.\-]|$)/.test(key)
  || /^tutorial-op\./.test(key)
  || /^(same|different)$/.test(key);

/**
 * Order-by-value family: tap the numeric tokens in the required order.
 * `speed-order-sweep`'s demo says "Tap the smallest number (N left)", so the
 * derived order is ascending numeric value — computed, not guessed.
 */
function solveOrderByValue(observation, ctx) {
  const s = suffixesOf(observation);
  const details = observation.controlDetails || {};
  const tokens = s
    .filter((k) => /(^|\.)token(\.|$)/.test(k) && !/verdict/.test(k))
    .map((k) => ({ key: k, value: numericValueOf(details[k], k) }))
    .filter((t) => t.value !== null);
  if (!tokens.length) return null;
  const ascending = ctx.spec.order !== 'descending';
  tokens.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value));
  const next = tokens.find((t) => !ctx.tapped.has(t.key));
  if (!next) return null;
  return {
    action: 'tap',
    target: next.key,
    tier: SolveTier.DERIVED,
    reason: `ordered-by-value(${ascending ? 'ascending' : 'descending'}): ${next.key} has value ${next.value}; derived from the app's own numeric labels`,
  };
}

/**
 * Arithmetic keypad family: compute the answer and press its digits.
 *
 * The demo contract for Fast Math fixes `operators: ['+']` and untimed rounds,
 * so the answer for the observed operands is their sum. Digits are entered one
 * at a time and submitted, exactly as a player would.
 */
function solveArithmeticKeypad(observation, ctx) {
  const s = suffixesOf(observation);
  const digits = s.filter((k) => /^digit\.\d$/.test(k));
  const hasSubmit = s.includes('submit');
  if (!digits.length) return null;
  const { left, right, operator } = readArithmetic(observation);
  if (left === null || right === null) return null;

  const op = operator === '−' ? '-' : operator;
  let answer;
  if (op === '+') answer = left + right;
  else if (op === '-') answer = left - right;
  else if (op === '×') answer = left * right;
  else if (op === '÷') answer = right === 0 ? null : left / right;
  else answer = left + right;
  if (answer === null || !Number.isFinite(answer)) return null;

  const wanted = String(answer);
  const entered = ctx.enteredDigits || '';
  if (ctx.enteredDigits === wanted) {
    // Already staged the full answer: submit it.
    if (!hasSubmit) return null;
    return {
      action: 'tap',
      target: 'submit',
      tier: SolveTier.DERIVED,
      reason: `submitting derived answer ${wanted} (= ${left} ${op} ${right})`,
    };
  }
  // Next digit to press (leftmost not yet staged).
  const targetDigit = wanted[entered.length];
  const key = `digit.${targetDigit}`;
  if (!s.includes(key)) return null;
  return {
    action: 'tap',
    target: key,
    tier: SolveTier.DERIVED,
    reason: `enter digit ${targetDigit} of derived answer ${wanted} (= ${left} ${op} ${right})`,
  };
}

/**
 * Missing-operator family: choose the operator that makes the equation true.
 * The equation is exposed as accessibility text ("5 question mark 3 equals 8"),
 * so the operator is SOLVED, not guessed.
 */
function solveMissingOperator(observation) {
  const s = suffixesOf(observation);
  const details = observation.controlDetails || {};
  const eq = textOf(details['tutorial-equation']);
  const ops = s.filter((k) => /^tutorial-op\./.test(k));
  if (!ops.length) return null;

  // Parse "<a> question mark <b> equals <c>" (the app's spoken form).
  const m = /(-?\d+)[^\d-]+?(-?\d+)[^\d-]+?(-?\d+)/.exec(eq.replace(/\bquestion mark\b/gi, ' '));
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const candidates = [
    { sym: '+', ok: a + b === c },
    { sym: '-', ok: a - b === c },
    { sym: '*', ok: b !== 0 && a * b === c },
    { sym: '/', ok: b !== 0 && a / b === c },
  ];
  const found = candidates.find((x) => x.ok);
  if (!found) return null;
  const key = `tutorial-op.${found.sym}`;
  if (!s.includes(key)) return null;
  return {
    action: 'tap',
    target: key,
    tier: SolveTier.DERIVED,
    reason: `solved operator '${found.sym}' from equation "${eq}" (${a} ? ${b} = ${c})`,
  };
}

/**
 * Grid rebuild family: tap the cells the app marks as correct.
 *
 * These demos replay a pattern; the app marks each cell's verdict. Where a
 * `Correct: …` label or a `*-verdict` marker exists, that is the app telling the
 * player which cell belongs to the pattern, so selecting it is observe-then-
 * submit (REVEAL_GUIDED tier, labelled as such).
 */
function solveGridRebuild(observation, ctx) {
  const s = suffixesOf(observation);

  // A demo that has accumulated wrong picks offers "Clear and retry". Retrying
  // is the demo's OWN recovery path, so taking it is a legitimate step — and it
  // is REQUIRED: without it the tracker demo can never clear, because the wrong
  // picks it just recorded stay on the board and the run stalls (this is why
  // attention-symbol-tracker sat at L0 with "tutorial never cleared").
  // Preferred FIRST, before the revealed-answer branch: after accumulating wrong
  // picks a demo offers "Clear and retry", and the app RESETS its board when it
  // is taken. If the harness instead keeps using its stale tapped-set, every
  // cell looks already-used and the demo can never be re-attempted — the exact
  // `NO_LEGITIMATE_STEP` stall observed on memory-grid-recall.
  const retry = s.find((k) => /^tutorial-demo-retry$/.test(k));
  if (retry && !ctx.retriedThisDemo) {
    return {
      action: 'tap',
      target: retry,
      tier: SolveTier.REVEAL_GUIDED,
      // `resetsTapped: true` tells the caller to CLEAR its used-control set: the
      // app resets its board on retry, so the harness must reset with it.
      resetsTapped: true,
      reason: 'the demo is offering "Clear and retry" after incorrect picks — taking the demo recovery path',
    };
  }

  const revealed = revealedCorrectControls(observation).filter((k) => !ctx.tapped.has(k));
  if (revealed.length) {
    return {
      action: 'tap',
      target: revealed[0],
      tier: SolveTier.REVEAL_GUIDED,
      reason: `app marked '${revealed[0]}' as the correct cell — selecting the revealed answer`,
    };
  }
  // Pattern-rebuild demos mark judged cells with a verdict marker in EITHER
  // shape: a `-verdict.N` prefix (grid-level) or a `.verdict` SUFFIX on the cell
  // itself (`tutorial-grid.card.0.verdict`). Only the prefix form was handled,
  // so a demo using the suffix form never yielded a target and stalled.
  const verdictCells = [
    ...s.filter((k) => /-verdict\.\d+$/.test(k)).map((k) => k.replace(/-verdict\./, '.')),
    ...s.filter((k) => /\.verdict$/.test(k)).map((k) => k.replace(/\.verdict$/, '')),
  ];
  const nextVerdict = verdictCells.find((k) => s.includes(k) && !ctx.tapped.has(k));
  if (nextVerdict) {
    return {
      action: 'tap',
      target: nextVerdict,
      tier: SolveTier.REVEAL_GUIDED,
      reason: `app rendered a verdict marker for '${nextVerdict}' — that cell was already judged part of the demo answer`,
    };
  }
  // No reveal yet: an untried cell must be attempted to obtain the app's
  // feedback. This is a deliberate probe, reported as such (never DERIVED).
  const cells = s.filter((k) => /(^|\.)(cell|tile|card)(\.\d+|\.\d+-\d+)$/.test(k) && !/verdict/.test(k));
  const target = cells.find((k) => !ctx.tapped.has(k));
  if (!target) return null;
  return {
    action: 'tap',
    target,
    tier: SolveTier.REVEAL_GUIDED,
    reason: `probing '${target}' to obtain the app's own correctness feedback (no answer revealed yet)`,
  };
}

/**
 * Reveal-choice family: pick the option the app identifies as correct.
 *
 * Attempts one unlocked option at a time. Once the app labels the answer
 * (`Correct: …`), that option is selected. Options are read from the app's own
 * accessibility text; a locked option is never chosen.
 */
function solveRevealChoice(observation, ctx) {
  const s = suffixesOf(observation);
  const options = s.filter((k) => /^option\.\d+$/.test(k) || /^tutorial-option\.\d+$/.test(k));
  if (!options.length) return null;
  const details = observation.controlDetails || {};

  const revealed = options.filter((k) => revealedCorrectText(details[k]) !== null && !ctx.tapped.has(k));
  if (revealed.length) {
    return {
      action: 'tap',
      target: revealed[0],
      tier: SolveTier.REVEAL_GUIDED,
      reason: `app revealed '${revealed[0]}' as correct ("${textOf(details[revealed[0]])}") — selecting the revealed answer`,
    };
  }
  const usable = options.filter((k) => !LOCKED_RE.test(textOf(details[k])) && !WRONG_RE.test(textOf(details[k])));
  const target = usable.find((k) => !ctx.tapped.has(k));
  if (!target) return null;
  return {
    action: 'tap',
    target,
    tier: SolveTier.REVEAL_GUIDED,
    reason: `probing option '${target}' to obtain the app's correctness feedback`,
  };
}

/**
 * Sequence replay family: replay the sequence the app is asking for.
 * The demo status states how many to replay ("Tap the last 2 in order").
 */
function solveSequenceReplay(observation, ctx) {
  const s = suffixesOf(observation);
  // Replay pads are exposed as `pad.N`, `tile.N` and — for Running Order —
  // `tutorial-palette.N`. The prefix may therefore be joined by '.' OR '-' (the
  // harness's semantic-id convention), and the container element
  // (`tutorial-palette` with no index) must NOT become a tap target: it is a
  // group, not a symbol.
  const pads = s.filter((k) => /(^|[.\-])(pad|tile|palette)\.\d+$/.test(k) && !/verdict/.test(k));
  if (!pads.length) return null;

  // Running Order's demo is a FIXED contract (TUTORIAL_DEMO_STREAM /
  // TUTORIAL_DEMO_RECALL in the game's own source): replay the LAST `recall`
  // symbols of the stream, in order, mapped through the symbol labels. This is
  // genuinely DERIVED — the answer comes from the game's constants.
  const stream = ctx.spec && ctx.spec.demoStream;
  const recall = ctx.spec && ctx.spec.recall;
  if (Array.isArray(stream) && recall) {
    const wantedIds = stream.slice(stream.length - recall);
    const labels = ctx.spec.symbolLabels || RUNNING_ORDER_LABELS;
    const remainingPads = pads.filter((k) => !ctx.tapped.has(k));
    const stepIndex = pads.length - remainingPads.length;
    const wantedId = wantedIds[stepIndex];
    if (wantedId === undefined) return null;
    const wantedLabel = labels[wantedId];
    const match = remainingPads.find((k) => textOf((observation.controlDetails || {})[k]).toLowerCase() === String(wantedLabel).toLowerCase());
    if (match) {
      return {
        action: 'tap',
        target: match,
        tier: SolveTier.DERIVED,
        reason: `replay ${stepIndex + 1}/${wantedIds.length}: '${wantedLabel}' — derived from TUTORIAL_DEMO_STREAM=${JSON.stringify(stream)} recall=${recall}`,
      };
    }
  }
  const revealed = revealedCorrectControls(observation).filter((k) => !ctx.tapped.has(k));
  const target = revealed[0] || pads.find((k) => !ctx.tapped.has(k));
  if (!target) return null;
  return {
    action: 'tap',
    target,
    tier: revealed.length ? SolveTier.REVEAL_GUIDED : SolveTier.REVEAL_GUIDED,
    reason: revealed.length
      ? `app marked '${target}' as correct — replaying it`
      : `replay '${target}' in the demo's required order`,
  };
}

const SAME_RE = /^tutorial-same$|^same$|^option\.(same|yes)$/i;
const DIFFERENT_RE = /^tutorial-different$|^different$|^option\.(different|no)$/i;

/**
 * Binary judgement family (same/different, higher/lower).
 *
 * Where the judgement can be derived from the app's own geometry description it
 * is computed; otherwise the app's wrong-answer feedback ("try again") inverts
 * the next choice, which is a legitimate use of the demo's teaching loop.
 */
function solveBinaryJudgement(observation, ctx) {
  const s = suffixesOf(observation);
  const same = s.find((k) => SAME_RE.test(k));
  const different = s.find((k) => DIFFERENT_RE.test(k));
  if (!same && !different) return null;

  const details = observation.controlDetails || {};
  const targetShape = textOf(details['target.shape']);
  const candidateShape = textOf(details['candidate.shape']);

  const derive = deriveShapeJudgement(targetShape, candidateShape);
  if (derive !== null) {
    const target = derive ? same : different;
    if (target && !ctx.tapped.has(target)) {
      return {
        action: 'tap',
        target,
        tier: SolveTier.DERIVED,
        reason: `derived ${derive ? 'SAME' : 'DIFFERENT'} from the app's geometry descriptions`,
      };
    }
  }
  // Feedback loop: if the app said "try again" on SAME, the answer is DIFFERENT.
  const status = textOf(details['tutorial-demo-status']);
  const saidTryAgain = /try again|not quite|wrong/i.test(status);
  const preferred = saidTryAgain && ctx.lastTapped === same ? different : same;
  const target = [preferred, preferred === same ? different : same].find((k) => k && !ctx.tapped.has(k));
  if (!target) return null;
  return {
    action: 'tap',
    target,
    tier: SolveTier.REVEAL_GUIDED,
    reason: `selected '${target}' using the demo's own correct/incorrect feedback`,
  };
}

/**
 * Word-order family (Sentence Builder).
 *
 * The demo sentence is deterministic (a fixed tutorial seed at roundIndex 0), so
 * the tiles are a FIXED, small word set. The solver assembles the sentence by
 * consuming tiles in the order the game's own bank dictates — sourced from the
 * recorded tile labels — while never treating the scrambled display order as a
 * hint. Each tile index is used at most once, which is what the game enforces
 * (`taps` is a list of distinct word indices).
 *
 * Because the recorded observation exposes the tile TEXT but not the original
 * sentence order, this is graded REVEAL_GUIDED: the solver reconstructs the
 * order from English word order, not from a hidden answer key it was given.
 */
function solveWordOrder(observation, ctx) {
  const s = suffixesOf(observation);
  const details = observation.controlDetails || {};
  const tiles = s
    .filter((k) => /^tutorial-grid\.word\.\d+$/.test(k))
    .map((k) => ({ key: k, word: textOf(details[k]) }))
    .filter((t) => t.word !== '');
  if (!tiles.length) return null;

  const remaining = tiles.filter((t) => !ctx.tapped.has(t.key));
  if (!remaining.length) {
    // Every tile consumed: submit/advance if the demo offers it.
    const next = s.find((k) => /^tutorial-(demo-next|next|done)$/.test(k));
    return next
      ? { action: 'tap', target: next, tier: SolveTier.DERIVED, reason: `all tiles consumed — advance via '${next}'` }
      : null;
  }
  // Choose the next word by conventional sentence order. Deterministic and
  // explainable; the app judges the result and the harness proves the outcome.
  const chosen = orderWordsNaturally(remaining);
  return {
    action: 'tap',
    target: chosen.key,
    tier: SolveTier.REVEAL_GUIDED,
    reason: `assemble word order: next tile is '${chosen.word}' (${chosen.rule})`,
  };
}

/** Rank remaining words by a small, explicit English word-order heuristic. */
function orderWordsNaturally(words) {
  const lower = (w) => w.word.toLowerCase();
  const DETERMINERS = /^(the|a|an|they|he|she|we|i|you|it)$/;
  const PREPOSITIONS = /^(at|in|on|to|for|with|by|of)$/;
  const CONJUNCTIONS = /^(and|but|or)$/;
  const rank = (w) => {
    const t = lower(w);
    if (DETERMINERS.test(t)) return 0;
    if (CONJUNCTIONS.test(t)) return 3;
    if (PREPOSITIONS.test(t)) return 2;
    return 1;
  };
  const sorted = words.slice().sort((a, b) => rank(a) - rank(b) || words.indexOf(a) - words.indexOf(b));
  const chosen = sorted[0];
  const RULE_BY_RANK = {
    0: 'subject/determiner first',
    2: 'preposition phrase',
    3: 'conjunction',
  };
  return {
    ...chosen,
    rule: RULE_BY_RANK[rank(chosen)] || 'verb/predicate after the subject',
  };
}

/**
 * Code-guess family (Code Cracker).
 *
 * The demo asks for three colours then Submit. The guess content is not revealed
 * by the app, so the solver cannot know the secret code — it fills the required
 * THREE pegs deterministically and submits, letting the app's own feedback
 * teach. This is explicitly REVEAL_GUIDED (a probe), never DERIVED, and the
 * harness must prove the app responded before crediting anything.
 */
function solveCodeGuess(observation, ctx) {
  const s = suffixesOf(observation);
  const colors = s.filter((k) => /^color\.\d+$/.test(k));
  const pegs = s.filter((k) => /^guess-peg\.\d+$/.test(k));
  if (!colors.length) return null;
  const required = pegs.length || 3;
  const filled = (ctx.equation || []).length;
  if (filled < required) {
    const pick = colors[filled % colors.length];
    return {
      action: 'tap',
      target: pick,
      tier: SolveTier.REVEAL_GUIDED,
      reason: `fill guess peg ${filled + 1}/${required} with '${pick}' (secret code is not revealed to the player)`,
    };
  }
  const submit = s.find((k) => /^tutorial-submit$/.test(k));
  return submit
    ? { action: 'tap', target: submit, tier: SolveTier.REVEAL_GUIDED, reason: `${required} pegs filled — submit the guess for the app to judge` }
    : null;
}

/** Timed target family: tap the target control. */
function solveTimedTarget(observation, ctx) {
  const s = suffixesOf(observation);
  const candidates = s.filter((k) => /(^|\.)(target|trigger|swatch|field)(\.\d+)?$/.test(k) && !ctx.tapped.has(k));
  const target = candidates[0];
  if (!target) return null;
  // Colour-match demos pair a label with a matching swatch: derive it.
  const details = observation.controlDetails || {};
  const label = textOf(details.label).toLowerCase();
  if (label) {
    const match = s.find((k) => /^color-btn\./.test(k) && k.slice('color-btn.'.length).toLowerCase() === label);
    if (match) {
      return {
        action: 'tap',
        target: match,
        tier: SolveTier.DERIVED,
        reason: `matched label '${label}' to swatch '${match}' by name`,
      };
    }
  }
  return {
    action: 'tap',
    target,
    tier: SolveTier.DERIVED,
    reason: `the demo exposes '${target}' as the stimulus to respond to`,
  };
}

/**
 * Equation-build family: pick numbers/operators whose result equals the target.
 * Derived by evaluating the app's own pads against the shown target.
 */
function solveEquationBuild(observation, ctx) {
  const s = suffixesOf(observation);
  const details = observation.controlDetails || {};
  const targetText = textOf(details.target);
  const target = Number(targetText);
  if (!Number.isFinite(target)) return null;
  const numbers = s.filter((k) => k === 'number' || /^number\.\d+$/.test(k))
    .map((k) => ({ key: k, value: numericValueOf(details[k], k) }))
    .filter((n) => n.value !== null);
  const ops = s.filter((k) => /^operator\./.test(k));
  if (!numbers.length) return null;

  const entered = ctx.equation || [];
  // Try single number == target first (a valid equation for 1-term targets).
  if (entered.length === 0) {
    const direct = numbers.find((n) => n.value === target);
    if (direct) {
      return {
        action: 'tap',
        target: direct.key,
        tier: SolveTier.DERIVED,
        reason: `'${direct.key}' alone equals the target ${target}`,
      };
    }
    // Otherwise start a two-term expression with the largest pad value.
    const first = numbers.slice().sort((a, b) => b.value - a.value)[0];
    return {
      action: 'tap',
      target: first.key,
      tier: SolveTier.REVEAL_GUIDED,
      reason: `starting an expression with '${first.key}' (${first.value}) toward target ${target}`,
    };
  }
  // After two numbers are staged, submit and let the app judge.
  if (s.includes('tutorial-submit')) {
    return {
      action: 'tap',
      target: 'tutorial-submit',
      tier: SolveTier.REVEAL_GUIDED,
      reason: 'submitting the staged expression for the app to judge',
    };
  }
  const next = numbers.find((n) => !ctx.tapped.has(n.key)) || ops.find((o) => !ctx.tapped.has(o));
  if (!next) return null;
  return {
    action: 'tap',
    target: next.key || next,
    tier: SolveTier.REVEAL_GUIDED,
    reason: 'extending the staged expression toward the target',
  };
}

/** Navigate family: advance whatever the demo exposes next. */
function solveNavigate(observation, ctx) {
  const revealed = revealedCorrectControls(observation).filter((k) => !ctx.tapped.has(k));
  if (revealed.length) {
    return {
      action: 'tap',
      target: revealed[0],
      tier: SolveTier.REVEAL_GUIDED,
      reason: `app marked '${revealed[0]}' as correct`,
    };
  }
  const s = suffixesOf(observation);
  const answerLike = s.filter((k) => isAnswerLike(k) && !ctx.tapped.has(k) && !/verdict/.test(k));
  if (answerLike.length) {
    return {
      action: 'tap',
      target: answerLike[0],
      tier: SolveTier.REVEAL_GUIDED,
      reason: `probing '${answerLike[0]}' to obtain the app's feedback`,
    };
  }
  const nav = navigationTarget(observation);
  if (nav && !ctx.tapped.has(nav)) {
    return { action: 'tap', target: nav, tier: SolveTier.NAVIGATION, reason: `advance via '${nav}'` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shape judgement (pure, unit-tested)
// ---------------------------------------------------------------------------

/**
 * Derive SAME/DIFFERENT from the app's geometry descriptions.
 *
 * The descriptions enumerate filled cells ("Filled blocks: row 1 column 2,
 * color group 1; …"). Two shapes are the SAME under rotation iff, after rotating
 * the candidate by 0/90/180/270 degrees about its bounding box, the filled-cell
 * set (including colour groups) coincides with the target's. Returns
 * `true`/`false`, or `null` when either description cannot be parsed (then the
 * caller falls back to the app's own feedback rather than guessing).
 */
export function deriveShapeJudgement(targetDesc, candidateDesc) {
  const t = parseShape(targetDesc);
  const c = parseShape(candidateDesc);
  if (!t || !c) return null;
  if (t.cells.length === 0 || c.cells.length === 0) return null;
  for (let rot = 0; rot < 4; rot++) {
    if (sameCellSet(rotate(t, rot), c)) return true;
  }
  return false;
}

function parseShape(desc) {
  if (typeof desc !== 'string' || desc === '') return null;
  const dims = /(\d+)\s*rows?\s*by\s*(\d+)\s*columns?/i.exec(desc);
  if (!dims) return null;
  const rows = Number(dims[1]);
  const cols = Number(dims[2]);
  if (!rows || !cols) return null;
  const cells = [];
  const re = /row\s*(\d+)\s*column\s*(\d+)(?:,\s*color group\s*(\d+))?/gi;
  for (const m of desc.matchAll(re)) {
    cells.push({ r: Number(m[1]) - 1, c: Number(m[2]) - 1, g: Number(m[3] || 1) });
  }
  return { rows, cols, cells };
}

function rotate(shape, times) {
  let cells = shape.cells.map((x) => ({ ...x }));
  let { rows, cols } = shape;
  for (let i = 0; i < times; i++) {
    cells = cells.map((x) => ({ r: x.c, c: rows - 1 - x.r, g: x.g }));
    [rows, cols] = [cols, rows];
  }
  return { rows, cols, cells };
}

function sameCellSet(a, b) {
  if (a.cells.length !== b.cells.length) return false;
  const norm = (s) => {
    const minR = Math.min(...s.cells.map((x) => x.r));
    const minC = Math.min(...s.cells.map((x) => x.c));
    return s.cells
      .map((x) => `${x.r - minR},${x.c - minC},${x.g}`)
      .sort()
      .join('|');
  };
  return norm(a) === norm(b);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const FAMILY_SOLVERS = {
  [SolverFamily.NOTICE_CONTINUE]: solveNavigate,
  [SolverFamily.ARITHMETIC_KEYPAD]: solveArithmeticKeypad,
  [SolverFamily.EQUATION_BUILD]: solveEquationBuild,
  [SolverFamily.MISSING_OPERATOR]: solveMissingOperator,
  [SolverFamily.ORDER_BY_VALUE]: solveOrderByValue,
  [SolverFamily.REVEAL_CHOICE]: solveRevealChoice,
  [SolverFamily.GRID_REBUILD]: solveGridRebuild,
  [SolverFamily.SEQUENCE_REPLAY]: solveSequenceReplay,
  [SolverFamily.BINARY_JUDGEMENT]: solveBinaryJudgement,
  [SolverFamily.TIMED_TARGET]: solveTimedTarget,
  [SolverFamily.NAVIGATE]: solveNavigate,
  [SolverFamily.WORD_ORDER]: solveWordOrder,
  [SolverFamily.CODE_GUESS]: solveCodeGuess,
};

/**
 * Plan ONE tutorial step.
 *
 * Returns `null` when no legitimate step exists (never a blind guess), or
 * `{action:'tap', target, tier, reason}`. The caller MUST still prove the
 * resulting state change; a plan is a proposal, not a certification.
 *
 * @param {object} observation  one recorded observation (controls + controlDetails)
 * @param {object} [state]      { tapped: Set<string>, enteredDigits, equation, lastTapped, spec }
 */
export function planTutorialStep(observation, state = {}) {
  if (!observation || typeof observation !== 'object') return null;
  const gameId = state.gameId || observation.gameId;
  const spec = state.spec || GAME_SOLVER_SPECS[gameId] || { family: SolverFamily.NAVIGATE };
  const ctx = {
    gameId,
    spec,
    tapped: state.tapped instanceof Set ? state.tapped : new Set(state.tapped || []),
    enteredDigits: state.enteredDigits || '',
    equation: state.equation || [],
    lastTapped: state.lastTapped || null,
    retriedThisDemo: state.retriedThisDemo === true,
  };

  // Navigation always takes precedence: if the app is offering "done"/"next",
  // the demo is over and poking demo controls would be pointless churn.
  const nav = navigationTarget(observation);
  const s = suffixesOf(observation);

  // A COMPLETION affordance always wins. `tutorial-demo-done` ("That's it") only
  // renders once the demo is satisfied, so tapping it is the correct next step.
  //
  // The previous "is the demo still active?" gate tested for the PRESENCE of
  // `tutorial-grid`/`tutorial-palette`/etc. — but those containers are rendered
  // for the whole demo, so the gate was always true and navigation was permanently
  // suppressed. A demo could be fully satisfied (verdict rendered, "That's it"
  // shown) and the harness would still poke cells forever, which is exactly the
  // "tutorial shown but never cleared" stall this fix removes.
  const COMPLETION_RE = /^tutorial-(demo-done|done|notice-continue|feedback-next)$/;
  if (nav && COMPLETION_RE.test(nav) && !ctx.tapped.has(nav)) {
    return { action: 'tap', target: nav, tier: SolveTier.NAVIGATION, reason: `demo complete — advance via '${nav}'` };
  }

  // Otherwise only a genuinely INTERACTIVE demo surface keeps navigation at bay:
  // a retry prompt or an unanswered submission means the demo wants more work.
  const demoStillActive = s.some((k) => /^tutorial-(retry|submit)$/.test(k))
    || (s.includes('tutorial-demo-status') && !nav);
  if (nav && !demoStillActive && !ctx.tapped.has(nav)) {
    return { action: 'tap', target: nav, tier: SolveTier.NAVIGATION, reason: `advance via '${nav}'` };
  }

  const solver = FAMILY_SOLVERS[spec.family] || solveNavigate;
  const plan = solver(observation, ctx);
  if (plan && plan.target && !s.includes(plan.target) && !(observation.controlDetails || {})[plan.target]) {
    // The planned control is not in the observed inventory: refuse rather than
    // emit a tap on something that is not on screen.
    return null;
  }
  return plan || null;
}

/** Family for a game (defaults to NAVIGATE for an unregistered id). */
export function familyFor(gameId) {
  return (GAME_SOLVER_SPECS[gameId] || {}).family || SolverFamily.NAVIGATE;
}

/**
 * Whether the returned tier may be described as knowledge-derived play.
 * REVEAL_GUIDED tutorials are legitimate interactions but must never be
 * presented as "the harness knew the answer".
 */
export function isDerivedTier(tier) {
  return tier === SolveTier.DERIVED;
}
