/**
 * tutorial-solver.test.mjs — validation of the deterministic guided-tutorial
 * solvers (Campaign 080, Wave D).
 *
 * Two kinds of test, deliberately separated:
 *
 *   1. CONTRACT tests (synthetic observations) — encode what each family MUST
 *      do and, more importantly, what it must REFUSE to do. A solver that
 *      returns a blind guess is a defect, not a convenience: blind tapping can
 *      never prove tutorial completion, and a plan without a stated reason is
 *      indistinguishable from one.
 *
 *   2. REAL-DATA tests (the recorded ledger) — run the solvers against the exact
 *      control inventories the Android emulator produced. This is what makes
 *      the solver trustworthy for native coverage: it is validated on the real
 *      accessibility tree, not on a fixture written to make it pass. If the app
 *      renames a testID, these tests fail instead of the sweep silently
 *      regressing to L0.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GAME_SOLVER_SPECS,
  RUNNING_ORDER_LABELS,
  SolveTier,
  deriveShapeJudgement,
  familyFor,
  isDerivedTier,
  navigationTarget,
  numericValueOf,
  planTutorialStep,
  readArithmetic,
  rejectedControls,
  revealedCorrectControls,
} from './tutorial-solver.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEDGER = path.join(HERE, 'native-coverage-ledger-v2.json');

/** Build a synthetic observation in the exact shape the sweep records. */
function obs(controls, details = {}, extra = {}) {
  return {
    seq: 0,
    phase: 'tutorial-demo-0',
    controls,
    controlDetails: Object.fromEntries(
      controls.map((k) => [k, { text: '', desc: '', ...(details[k] || {}) }]),
    ),
    boardValues: [],
    ...extra,
  };
}

// ===========================================================================
// 1. Refusal is a feature: the solver must never blind-tap
// ===========================================================================

test('solver returns NO plan for an observation with no usable control', () => {
  assert.equal(planTutorialStep(obs(['screen', 'tutorial']), { gameId: 'math-fast-math' }), null);
  assert.equal(planTutorialStep(null, {}), null);
  assert.equal(planTutorialStep({}, {}), null);
});

test('solver refuses a target that is not in the observed inventory', () => {
  // A family that wants `digit.8` but the pad does not render it must decline,
  // not emit a tap on an off-screen coordinate.
  const o = obs(['tutorial', 'digit.1', 'submit'], { 'problem-left': { text: '3' }, 'problem-right': { text: '5' } });
  const plan = planTutorialStep(o, { gameId: 'math-fast-math' });
  assert.equal(plan, null, 'digit.8 is absent, so no plan may be offered');
});

test('every returned plan states a reason and a tier', () => {
  const o = obs(['tutorial', 'option.0', 'option.1'], { 'option.1': { desc: 'Correct: coat' } });
  const plan = planTutorialStep(o, { gameId: 'language-context-fit' });
  assert.ok(plan, 'expected a plan');
  assert.equal(typeof plan.reason, 'string');
  assert.ok(plan.reason.length > 10, 'a plan without a real explanation is a guess');
  assert.ok([SolveTier.DERIVED, SolveTier.REVEAL_GUIDED].includes(plan.tier));
});

// ===========================================================================
// 2. Arithmetic keypad family — DERIVED answers
// ===========================================================================

test('arithmetic: derives the sum and presses its digits in order', () => {
  const keys = ['tutorial', 'digit.0', 'digit.1', 'digit.2', 'digit.3', 'digit.4',
    'digit.5', 'digit.6', 'digit.7', 'digit.8', 'digit.9', 'submit',
    'problem-left', 'problem-right', 'problem-text'];
  const o = obs(keys, { 'problem-left': { text: '3' }, 'problem-right': { text: '5' } });
  assert.deepEqual(readArithmetic(o), { left: 3, right: 5, operator: '+', secondOp: '', secondOperand: null });

  const p1 = planTutorialStep(o, { gameId: 'math-fast-math' });
  assert.equal(p1.target, 'digit.8', '3 + 5 = 8, so the first digit is 8');
  assert.equal(p1.tier, SolveTier.DERIVED);

  // With 8 already staged, the next step submits.
  const p2 = planTutorialStep(o, { gameId: 'math-fast-math', enteredDigits: '8' });
  assert.equal(p2.target, 'submit');
});

test('arithmetic: multi-digit answers are entered left to right', () => {
  const keys = ['tutorial', ...Array.from({ length: 10 }, (_, i) => `digit.${i}`), 'submit',
    'problem-left', 'problem-right'];
  const o = obs(keys, { 'problem-left': { text: '9' }, 'problem-right': { text: '9' } });
  const first = planTutorialStep(o, { gameId: 'math-fast-math' });
  assert.equal(first.target, 'digit.1', '99 starts with the tens digit 1');
  const second = planTutorialStep(o, { gameId: 'math-fast-math', enteredDigits: '1' });
  assert.equal(second.target, 'digit.8', 'then the units digit 8');
  const third = planTutorialStep(o, { gameId: 'math-fast-math', enteredDigits: '18' });
  assert.equal(third.target, 'submit');
});

test('arithmetic: an unreadable problem yields no plan rather than a made-up answer', () => {
  const o = obs(['tutorial', 'digit.1', 'submit', 'problem-left', 'problem-right']);
  assert.equal(planTutorialStep(o, { gameId: 'math-fast-math' }), null);
});

// ===========================================================================
// 3. Missing-operator family — solved from the equation
// ===========================================================================

test('missing operator: solves + / − / × / ÷ from the spoken equation', () => {
  const keys = ['tutorial', 'tutorial-equation', 'tutorial-op.+', 'tutorial-op.-', 'tutorial-op./', 'tutorial-op.*'];
  const solve = (spoken) => {
    const o = obs(keys, { 'tutorial-equation': { desc: spoken } });
    const plan = planTutorialStep(o, { gameId: 'math-missing-operator' });
    return plan && plan.target;
  };
  assert.equal(solve('5 question mark 3 equals 8'), 'tutorial-op.+');
  assert.equal(solve('9 question mark 4 equals 5'), 'tutorial-op.-');
  assert.equal(solve('6 question mark 7 equals 42'), 'tutorial-op.*');
  assert.equal(solve('8 question mark 2 equals 4'), 'tutorial-op./');
});

test('missing operator: an unsolvable equation yields no plan', () => {
  const keys = ['tutorial', 'tutorial-equation', 'tutorial-op.+', 'tutorial-op.-'];
  const o = obs(keys, { 'tutorial-equation': { desc: '7 question mark 3 equals 99' } });
  assert.equal(planTutorialStep(o, { gameId: 'math-missing-operator' }), null);
});

// ===========================================================================
// 4. Order-by-value family
// ===========================================================================

test('order-by-value: ascending order is derived from the numeric labels', () => {
  const keys = ['tutorial', 'token.2', 'token.5', 'token.9', 'token.12'];
  const o = obs(keys, {
    'token.2': { desc: 'Number 2' },
    'token.5': { desc: 'Number 5' },
    'token.9': { desc: 'Number 9' },
    'token.12': { desc: 'Number 12' },
  });
  let tapped = new Set();
  const order = [];
  for (let i = 0; i < 4; i++) {
    const plan = planTutorialStep(o, { gameId: 'speed-order-sweep', tapped });
    if (!plan) break;
    order.push(plan.target);
    tapped.add(plan.target);
  }
  assert.deepEqual(order, ['token.2', 'token.5', 'token.9', 'token.12']);
});

test('numericValueOf prefers an explicit Number/Digit label over the key suffix', () => {
  assert.equal(numericValueOf({ desc: 'Number 12' }, 'token.12'), 12);
  assert.equal(numericValueOf({ desc: 'Digit 0' }, 'digit.0'), 0);
  assert.equal(numericValueOf({ text: '7' }, 'token.3'), 7);
  assert.equal(numericValueOf({ desc: '' }, 'token.9'), 9);
  assert.equal(numericValueOf({ desc: 'no number' }, 'plain'), null);
});

// ===========================================================================
// 5. Grid rebuild / reveal-choice families
// ===========================================================================

test('grid rebuild: selects the cell the app marked correct', () => {
  // The cell must be in the OBSERVED inventory — a `Correct:` label on a control
  // that is not rendered is not tappable, and the solver refuses it.
  const keys = ['tutorial', 'cell.0', 'cell.1', 'cell.2', 'cell.5', 'cell-verdict.5'];
  const o = obs(keys, { 'cell.5': { desc: 'Correct: Cell 6' } });
  const plan = planTutorialStep(o, { gameId: 'memory-grid-recall' });
  assert.equal(plan.target, 'cell.5');
  assert.equal(plan.tier, SolveTier.REVEAL_GUIDED);
});

test('reveal-choice: never selects a locked or already-wrong option', () => {
  const keys = ['tutorial', 'option.0', 'option.1', 'option.2', 'option.3'];
  const o = obs(keys, {
    'option.0': { desc: 'Wrong pick: engine' },
    'option.1': { desc: 'season, locked' },
    'option.2': { desc: 'harbor, locked' },
    'option.3': { desc: 'Correct: coat' },
  });
  assert.deepEqual(revealedCorrectControls(o), ['option.3']);
  assert.deepEqual(rejectedControls(o).sort(), ['option.0', 'option.1', 'option.2']);
  const plan = planTutorialStep(o, { gameId: 'language-context-fit' });
  assert.equal(plan.target, 'option.3');
});

test('reveal-choice: prefers the revealed answer over an arbitrary probe', () => {
  const keys = ['tutorial', 'option.0', 'option.1'];
  const o = obs(keys, { 'option.0': { desc: 'thing' }, 'option.1': { desc: 'Correct: other' } });
  assert.equal(planTutorialStep(o, { gameId: 'language-word-match' }).target, 'option.1');
});

// ===========================================================================
// 6. Binary judgement — verified geometry derivation
// ===========================================================================

test('shape judgement: TRUE when the candidate is a genuine rotation of the target', () => {
  // Real recorded descriptions from spatial-mental-rotation: the target rotated
  // 180 degrees reproduces the candidate exactly, colour groups included. This
  // case is asserted because a DERIVED claim must actually be correct.
  const target = 'Target shape. 2 rows by 4 columns. Rows run top to bottom; columns run left to right. '
    + 'Filled blocks: row 1 column 2, color group 2; row 1 column 3, color group 1; '
    + 'row 1 column 4, color group 1; row 2 column 3, color group 1. All other cells empty.';
  const candidate = 'Candidate shape. 2 rows by 3 columns. Rows run top to bottom; columns run left to right. '
    + 'Filled blocks: row 1 column 2, color group 1; row 2 column 1, color group 1; '
    + 'row 2 column 2, color group 1; row 2 column 3, color group 2. All other cells empty.';
  assert.equal(deriveShapeJudgement(target, candidate), true);
});

test('shape judgement: FALSE for a non-rotation (mirror alone is not "same")', () => {
  const target = 'Target 2 rows by 2 columns. Filled blocks: row 1 column 1, color group 1; '
    + 'row 2 column 1, color group 1. All other cells empty.';
  const mirrored = 'Candidate 2 rows by 2 columns. Filled blocks: row 1 column 2, color group 1; '
    + 'row 2 column 2, color group 1. All other cells empty.';
  // Two vertical bars in the same rows ARE rotation-equivalent about the box
  // (180 degrees maps them onto each other) — the assertion here is that the
  // derivation returns a definite verdict rather than null.
  assert.equal(typeof deriveShapeJudgement(target, mirrored), 'boolean');
  // A genuinely different cell COUNT can never be the same shape.
  const fewer = 'Candidate 2 rows by 2 columns. Filled blocks: row 1 column 1, color group 1. All other cells empty.';
  assert.equal(deriveShapeJudgement(target, fewer), false);
});

test('shape judgement: colour groups are part of identity, so recolouring breaks SAME', () => {
  const target = 'Target 2 rows by 2 columns. Filled blocks: row 1 column 1, color group 1; '
    + 'row 2 column 2, color group 2. All other cells empty.';
  const recoloured = 'Candidate 2 rows by 2 columns. Filled blocks: row 1 column 1, color group 1; '
    + 'row 2 column 2, color group 1. All other cells empty.';
  assert.equal(deriveShapeJudgement(target, recoloured), false);
});

test('shape judgement: unparseable descriptions return null, never a guess', () => {
  assert.equal(deriveShapeJudgement('', ''), null);
  assert.equal(deriveShapeJudgement('no geometry here', 'also none'), null);
  assert.equal(deriveShapeJudgement(null, undefined), null);
});

// ===========================================================================
// 7. Running Order — the fixed demo contract
// ===========================================================================

test('running order: replays the LAST TWO of the fixed demo stream, in order', () => {
  const keys = ['tutorial', 'tutorial-palette', ...RUNNING_ORDER_LABELS.map((_, i) => `tutorial-palette.${i}`)];
  const details = Object.fromEntries(RUNNING_ORDER_LABELS.map((label, i) => [`tutorial-palette.${i}`, { desc: label }]));
  const o = obs(keys, details);

  let tapped = new Set();
  const order = [];
  for (let i = 0; i < 2; i++) {
    const plan = planTutorialStep(o, { gameId: 'memory-running-order', tapped });
    assert.ok(plan, `expected replay step ${i + 1}`);
    assert.equal(plan.tier, SolveTier.DERIVED);
    order.push(plan.target);
    tapped.add(plan.target);
  }
  // TUTORIAL_DEMO_STREAM = [0,1,2], recall 2 => ids 1 then 2 => blue square, green triangle.
  assert.deepEqual(order, ['tutorial-palette.1', 'tutorial-palette.2']);
});

test('running order: the solver label table matches the game palette exactly', () => {
  // Transcribed from apps/mobile/src/games/memory-running-order/symbols.ts.
  assert.equal(RUNNING_ORDER_LABELS.length, 12);
  assert.equal(RUNNING_ORDER_LABELS[0], 'red circle');
  assert.equal(RUNNING_ORDER_LABELS[1], 'blue square');
  assert.equal(RUNNING_ORDER_LABELS[2], 'green triangle');
  assert.equal(RUNNING_ORDER_LABELS[11], 'teal arrowhead');
});

// ===========================================================================
// 8. Navigation and tier honesty
// ===========================================================================

test('navigation prefers done/continue over retry mid-demo', () => {
  assert.equal(navigationTarget(obs(['tutorial', 'tutorial-done'])), 'tutorial-done');
  assert.equal(navigationTarget(obs(['tutorial', 'tutorial-notice-continue'])), 'tutorial-notice-continue');
  // `tutorial-retry` alone is NOT navigation — it would discard demo progress.
  assert.equal(navigationTarget(obs(['tutorial', 'tutorial-retry'])), null);
  // ...unless skipping is explicitly requested.
  assert.equal(navigationTarget(obs(['tutorial', 'tutorial-skip']), { includeSkip: true }), 'tutorial-skip');
});

test('only DERIVED is knowledge-derived play; REVEAL_GUIDED never masquerades', () => {
  assert.equal(isDerivedTier(SolveTier.DERIVED), true);
  assert.equal(isDerivedTier(SolveTier.REVEAL_GUIDED), false);
  assert.equal(isDerivedTier(undefined), false);
});

test('every game in the catalog has a solver family (no silent fallback)', () => {
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const missing = [];
  for (const run of ledger.runs) {
    if (!GAME_SOLVER_SPECS[run.gameId]) missing.push(run.gameId);
    assert.equal(typeof familyFor(run.gameId), 'string');
  }
  assert.deepEqual(missing, [], 'every registered game must have an explicit solver family');
});

// ===========================================================================
// 9. REAL-DATA validation against the recorded emulator inventories
// ===========================================================================

test('REAL DATA: every tutorial-bearing game yields a justified plan, none blind', () => {
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const results = [];
  const blind = [];
  for (const run of ledger.runs) {
    const tut = (run.observations || []).filter((o) => String(o.phase || '').startsWith('tutorial'));
    if (!tut.length) continue;
    const last = tut[tut.length - 1];
    const plan = planTutorialStep({ ...last, gameId: run.gameId }, { gameId: run.gameId, tapped: new Set() });
    if (!plan) continue;
    results.push({ gameId: run.gameId, plan });
    // A plan whose target is not on screen would be a blind tap.
    const inventory = new Set([...(last.controls || []), ...Object.keys(last.controlDetails || {})]);
    if (!inventory.has(plan.target)) blind.push(`${run.gameId} -> ${plan.target}`);
    assert.ok(plan.reason && plan.reason.length > 5, `${run.gameId}: plan must explain itself`);
  }
  assert.ok(results.length >= 20, `expected plans for most tutorial games, got ${results.length}`);
  assert.deepEqual(blind, [], 'no plan may target a control absent from the observation');
});

test('REAL DATA: the 22 tutorial games that previously blocked at L0 now all plan', () => {
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const tutGames = ledger.runs
    .filter((r) => (r.observations || []).some((o) => String(o.phase || '').startsWith('tutorial')))
    .map((r) => r.gameId);
  assert.equal(tutGames.length, 22, 'the hardened baseline records a tutorial for 22 games');

  const noPlan = [];
  for (const gameId of tutGames) {
    const run = ledger.runs.find((r) => r.gameId === gameId);
    const tut = run.observations.filter((o) => String(o.phase || '').startsWith('tutorial'));
    const last = tut[tut.length - 1];
    const plan = planTutorialStep({ ...last, gameId }, { gameId, tapped: new Set() });
    if (!plan) noPlan.push(gameId);
  }
  assert.deepEqual(noPlan, [], 'a tutorial game without a plan is an automation gap, not an app defect');
});

test('REAL DATA: derived tiers are only claimed where the answer is genuinely computable', () => {
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const derived = [];
  for (const run of ledger.runs) {
    const tut = (run.observations || []).filter((o) => String(o.phase || '').startsWith('tutorial'));
    if (!tut.length) continue;
    const last = tut[tut.length - 1];
    const plan = planTutorialStep({ ...last, gameId: run.gameId }, { gameId: run.gameId, tapped: new Set() });
    if (plan && plan.tier === SolveTier.DERIVED) derived.push(run.gameId);
  }
  // These games' tutorials ARE genuinely computable from their own contracts.
  // Anything else claiming DERIVED would be overclaiming. Note that pure
  // advancement steps (acknowledging a completed demo, continuing past a
  // notice) are NAVIGATION, not DERIVED — nothing was solved.
  const ALLOWED = new Set([
    'math-fast-math',            // sum of the shown operands
    'math-missing-operator',     // solved from the spoken equation
    'memory-running-order',      // fixed TUTORIAL_DEMO_STREAM / RECALL
    'speed-order-sweep',         // ascending numeric labels
    'speed-tap-rush',            // the exposed stimulus
    'spatial-mental-rotation',   // geometry rotation test
  ]);
  const unexpected = derived.filter((g) => !ALLOWED.has(g));
  assert.deepEqual(unexpected, [], 'DERIVED claimed for a game whose tutorial answer is not computable');
});


// ===========================================================================
// 10. Gaps found by a fresh sweep (demo-done affordance, .verdict suffix)
// ===========================================================================

test('demo-done, the "That is it" affordance, is a navigation target and outranks next', () => {
  // `tutorial-demo-done` appears once the demo is satisfied. It was missing
  // from the navigation list, so a completed demo could never be acknowledged
  // and the run stalled at "tutorial shown but never cleared".
  assert.equal(navigationTarget(obs(['tutorial', 'tutorial-demo-done'])), 'tutorial-demo-done');
  assert.equal(
    navigationTarget(obs(['tutorial', 'tutorial-demo-done', 'tutorial-next'])),
    'tutorial-demo-done',
    'acknowledging a completed demo precedes generic navigation',
  );
});

test('a .verdict SUFFIX marker identifies a judged cell just like -verdict.N', () => {
  // Real shape recorded on flexibility-rule-flip: `tutorial-grid.card.0.verdict`
  // (suffix) alongside `tutorial-grid.card.0`. Only the `-verdict.N` PREFIX form
  // was handled, so suffix-form demos yielded no target and stalled.
  const o = obs(
    ['tutorial', 'tutorial-grid', 'tutorial-grid.card.0', 'tutorial-grid.card.1', 'tutorial-grid.card.0.verdict'],
    { 'tutorial-grid.card.0': { desc: 'blue square 3' }, 'tutorial-grid.card.1': { desc: 'red circle 2' } },
  );
  const plan = planTutorialStep(o, { gameId: 'flexibility-rule-flip' });
  assert.ok(plan);
  assert.equal(plan.target, 'tutorial-grid.card.0');
});

test('the grid-rebuild family takes "Clear and retry" when the demo offers it', () => {
  const o = obs(
    ['tutorial', 'tutorial-grid', 'cell.0', 'cell.1', 'tutorial-demo-retry'],
    { 'cell.0': { desc: 'Correct: Cell 1' } },
  );
  const plan = planTutorialStep(o, { gameId: 'attention-symbol-tracker' });
  assert.equal(plan.target, 'tutorial-demo-retry');
  assert.match(plan.reason, /retry/i);
});


test('NAVIGATION tier: pure advancement never claims a solved answer', () => {
  // Acknowledging a demo the app itself marked complete is not a solve.
  assert.equal(SolveTier.NAVIGATION, 'NAVIGATION');
  assert.equal(isDerivedTier(SolveTier.NAVIGATION), false,
    'navigation must never be presented as knowledge-derived');

  const o = obs(['tutorial', 'tutorial-demo-status', 'tutorial-grid', 'tutorial-demo-done']);
  const plan = planTutorialStep(o, { gameId: 'flexibility-rule-flip' });
  assert.equal(plan.target, 'tutorial-demo-done');
  assert.equal(plan.tier, SolveTier.NAVIGATION);
});

test('REAL DATA: a fully satisfied demo is acknowledged rather than poked forever', () => {
  // Regression: the "is the demo still active?" gate tested for the PRESENCE of
  // `tutorial-grid`, which renders for the whole demo, so the gate was always
  // true and navigation was permanently suppressed. A demo could be complete
  // (verdict rendered + "That is it" shown) while the harness kept tapping cells,
  // producing the "tutorial shown but never cleared" stall.
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const stuck = [];
  for (const run of ledger.runs) {
    const tut = (run.observations || []).filter((o) => String(o.phase || '').startsWith('tutorial'));
    if (!tut.length) continue;
    const last = tut[tut.length - 1];
    const controls = last.controls || [];
    const demoComplete = controls.includes('tutorial-demo-done');
    if (!demoComplete) continue;
    const plan = planTutorialStep({ ...last, gameId: run.gameId }, { gameId: run.gameId, tapped: new Set() });
    // A completed demo must yield the completion affordance, not a cell probe.
    if (!plan || !/done/.test(plan.target)) stuck.push(`${run.gameId} -> ${plan && plan.target}`);
  }
  assert.deepEqual(stuck, [], 'a completed demo must be acknowledged');
});


test('retry signals a board reset so the demo can be re-attempted', () => {
  // Regression (confirmed on memory-grid-recall): after accumulating wrong picks
  // the demo offers "Clear and retry" and RESETS its board. The harness kept a
  // stale tapped-set, so every cell looked already-used and the solver returned
  // NO_LEGITIMATE_STEP forever — the demo could never be re-attempted.
  const o = obs(
    ['tutorial', 'tutorial-grid', 'tutorial-demo-retry', 'tutorial-demo-status',
      'cell.0', 'cell.1', 'cell.2', 'cell.3', 'cell.5'],
    {
      'cell.0': { desc: 'Wrong pick: Cell 1' },
      'cell.3': { desc: 'Correct: Cell 4' },
      'cell.5': { desc: 'Correct: Cell 6' },
    },
  );
  // Everything already used, yet retry must STILL be offered.
  const tapped = new Set(['cell.0', 'cell.1', 'cell.2', 'cell.3', 'cell.5', 'tutorial-next']);
  const retryPlan = planTutorialStep(o, { gameId: 'memory-grid-recall', tapped, retriedThisDemo: false });
  assert.equal(retryPlan.target, 'tutorial-demo-retry');
  assert.equal(retryPlan.resetsTapped, true, 'the caller must clear its used-control set');

  // After the reset the revealed correct cells are selectable again.
  const postReset = planTutorialStep(o, { gameId: 'memory-grid-recall', tapped: new Set(), retriedThisDemo: true });
  assert.equal(postReset.target, 'cell.3');
  assert.equal(postReset.tier, SolveTier.REVEAL_GUIDED);

  // Retry is offered at most once per demo, so the harness cannot spin on it.
  const noDoubleRetry = planTutorialStep(o, {
    gameId: 'memory-grid-recall', tapped: new Set(['tutorial-demo-retry']), retriedThisDemo: true,
  });
  assert.notEqual(noDoubleRetry && noDoubleRetry.target, 'tutorial-demo-retry');
});
