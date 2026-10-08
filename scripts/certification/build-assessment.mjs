#!/usr/bin/env node
/**
 * 076-f tasks 3.21 / 3.22 — publish the one-row-per-game current-device
 * assessment.
 *
 * One row per registered game, using ONLY the four permitted values:
 *   PASS         the current-device check ran and every required state was
 *                observed on the installed terminal candidate
 *   FIXED        as PASS, and a reproduced defect was repaired with a guard
 *   NOT VALIDATED the check did not establish the states
 *   N/A          a state legitimately does not apply (justification required)
 *
 * Deliberately conservative: a row is PASS only when the controller produced a
 * substantive review note for THAT game. An intro, an unanswered board, a
 * placeholder note, a note describing a different game, or a filename is never
 * counted as scored feedback or as acceptance.
 *
 * Usage: node scripts/certification/build-assessment.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EV = path.join(
  ROOT, 'openspec', 'changes', '076-f-final-product-certification', 'evidence',
);
const ROWS = path.join(EV, 'current-device');

/** The 42 registered games, grouped by domain, from the game registry. */
const GAMES = [
  ['attention', 'attention-odd-one-out', '6.1'],
  ['attention', 'attention-sustained-vigilance', '6.2'],
  ['attention', 'attention-symbol-tracker', '6.3'],
  ['attention', 'attention-target-count', '—'],
  ['attention', 'attention-visual-search', '6.5'],
  ['flexibility', 'flexibility-card-sort', '—'],
  ['flexibility', 'flexibility-color-stroop', '7.2'],
  ['flexibility', 'flexibility-cue-shift', '—'],
  ['flexibility', 'flexibility-rule-flip', '—'],
  ['flexibility', 'flexibility-task-switch', '7.5'],
  ['language', 'language-context-fit', '8.1'],
  ['language', 'language-sentence-builder', '—'],
  ['language', 'language-word-chain', '8.3'],
  ['language', 'language-word-match', '8.4'],
  ['language', 'language-word-scramble', '8.5'],
  ['logic', 'logic-code-cracker', '9.1'],
  ['logic', 'logic-deduction-table', '—'],
  ['logic', 'logic-next-sequence', '—'],
  ['logic', 'logic-order-path', '—'],
  ['logic', 'logic-rule-grid', '—'],
  ['math', 'math-equation-builder', '10.1'],
  ['math', 'math-fast-math', '10.2'],
  ['math', 'math-missing-operator', '—'],
  ['math', 'math-number-line-estimation', '10.4'],
  ['math', 'math-value-ordering', '10.5'],
  ['memory', 'memory', '—'],
  ['memory', 'memory-grid-recall', '—'],
  ['memory', 'memory-pair-recall', '—'],
  ['memory', 'memory-pattern-tap-back', '—'],
  ['memory', 'memory-prospective-cue', '11.5'],
  ['memory', 'memory-running-order', '11.6'],
  ['memory', 'memory-sequence-memory', '—'],
  ['spatial', 'spatial-coordinate-turn', '—'],
  ['spatial', 'spatial-fold-match', '—'],
  ['spatial', 'spatial-grid-nav', '12.3'],
  ['spatial', 'spatial-mental-rotation', '—'],
  ['spatial', 'spatial-transform-match', '—'],
  ['speed', 'speed-color-match', '—'],
  ['speed', 'speed-order-sweep', '—'],
  ['speed', 'speed-quick-compare', '13.3'],
  ['speed', 'speed-reaction-time', '—'],
  ['speed', 'speed-tap-rush', '13.5'],
];

/**
 * Manual reviewer verdicts, authored after this reviewer opened the filed
 * controller note AND the filed device frame and confirmed the row really shows
 * that game. This file is the decisive input for identity: structural checks
 * cannot tell a note about the wrong game from a note about the right one.
 */
const MANUAL = path.join(ROWS, 'manual-review.json');

function expectedTitle(id) {
  const domains = ['attention', 'flexibility', 'language', 'logic', 'math', 'memory', 'spatial', 'speed'];
  const first = id.split('-')[0];
  const rest = domains.includes(first) ? id.slice(first.length + 1) : id;
  return rest.replace(/-/g, ' ');
}

/** Structural check only: does the row hold substantive, non-skeleton content
 *  for every state the requirement names? Identity is NOT decided here. */
function structure(id) {
  const review = path.join(ROWS, id, 'review.md');
  if (!existsSync(review)) {
    return { ok: false, note: 'absent', reason: 'no current-device row yet' };
  }
  const text = readFileSync(review, 'utf8');
  if (/Controller review note: ABSENT/i.test(text)) {
    return { ok: false, note: 'absent', reason: 'controller produced no usable review note' };
  }
  if (/to be (filled|populated|recorded)|pending (execution|observation|review)|\[pending|\(pending|not yet (filled|recorded|observed)/i.test(text)) {
    return { ok: false, note: 'placeholder', reason: 'review note is an unfilled skeleton' };
  }
  const body = text.split(/## Controller state-review log/i)[1] ?? '';
  const required = ['Active Play Board', 'Scored Feedback', 'Pause', 'Final Result'];
  const missing = required.filter((h) => {
    const re = new RegExp(`##[^\\n]*${h.replace(/ /g, '\\s+')}[^\\n]*\\n([\\s\\S]{0,400})`, 'i');
    const seg = (body.match(re) ?? [])[1] ?? '';
    return seg.trim().length < 20;
  });
  if (missing.length > 0) {
    return { ok: false, note: 'present', reason: `states not evidenced: ${missing.join(', ')}` };
  }

  // SCORED FEEDBACK must be a QUOTED verdict, not a description of the game's
  // feedback mechanism. The change spec is explicit: "Feedback is not
  // inferred" - an intro, an unanswered board or a filename is never scored
  // feedback, and neither is prose about how feedback generally works.
  const fbMatch = body.match(/##[^\n]*Scored\s+Feedback[^\n]*\n([\s\S]*?)(?=\n##|$)/i);
  const fb = (fbMatch ?? [])[1] ?? '';
  if (!/["'\u201c\u201d].{2,120}["'\u201c\u201d]/.test(fb)) {
    return {
      ok: false,
      note: 'present',
      reason: 'scored feedback not evidenced - the Scored Feedback section contains no quoted correct/incorrect/timeout verdict',
    };
  }
  return { ok: true, note: 'present', reason: '' };
}

function classify(id, manual) {
  const s = structure(id);
  const m = manual[id];

  // FAIL CLOSED FIRST: a manual verdict can refine a structurally sound row,
  // but it must never promote a row that lacks the required states. A reviewer
  // note saying "PASS" over an empty or partial row is exactly how the
  // flexibility-card-sort over-claim got published (076-f review finding F6).
  if (!s.ok && (!m || m.status === 'PASS' || m.status === 'FIXED')) {
    return {
      status: 'NOT VALIDATED',
      reason: `${s.reason}${m ? ` (reviewer marked ${m.status} but the row does not evidence every required state)` : ''}`,
      note: s.note,
      identity: m ? m.identity : 'unreviewed',
    };
  }

  // A manual verdict wins only over a structurally complete row.
  if (m) {
    return {
      status: m.status === 'N-A' ? 'N/A' : m.status,
      reason: m.note,
      note: s.note,
      identity: m.identity,
    };
  }

  // Structurally complete but not yet manually verified for identity: the
  // change spec forbids accepting a state from anything but inspection, so this
  // stays NOT VALIDATED until a reviewer confirms it is the right game.
  return {
    status: 'NOT VALIDATED',
    reason: `structurally complete but not yet identity-verified by the reviewer for \`${expectedTitle(id)}\``,
    note: s.note,
    identity: 'pending-review',
  };
}

/** Load the manual identity verdicts, failing closed on a malformed file. */
function loadManualVerdicts() {
  if (!existsSync(MANUAL)) return {};
  let raw;
  try {
    raw = readFileSync(MANUAL, 'utf8');
  } catch (error) {
    throw new Error(`cannot read manual review verdicts ${path.relative(ROOT, MANUAL)}: ${error.message}`);
  }
  try {
    const parsed = JSON.parse(raw);
    const verdicts = parsed?.verdicts;
    if (verdicts === null || typeof verdicts !== 'object') {
      throw new Error('expected an object at `.verdicts`');
    }
    return verdicts;
  } catch (error) {
    throw new Error(`malformed manual review verdicts ${path.relative(ROOT, MANUAL)}: ${error.message}`);
  }
}

const manualVerdicts = loadManualVerdicts();

const rows = GAMES.map(([domain, id, parentTask]) => {
  const c = classify(id, manualVerdicts);
  return { domain, game: id, parentTask, ...c };
});

const counts = rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
const lines = [];
lines.push('# Current-device game assessment — 076-f');
lines.push('');
lines.push('**Tasks:** 3.21 (current-device rows for the 22 games whose parent redesign');
lines.push('tasks are already checked) and 3.22 (publish the one-row-per-game assessment).');
lines.push('');
lines.push('Generated by `node scripts/certification/build-assessment.mjs` from the filed');
lines.push('current-device rows. One row per registered game. **Only** `PASS`, `FIXED`,');
lines.push('`NOT VALIDATED` or justified `N/A` are used.');
lines.push('');
lines.push('## Rules applied');
lines.push('');
lines.push('- An intro screen, an unanswered board, or a filename is **never** counted as');
lines.push('  scored feedback. Scored feedback requires a quoted correct/incorrect/timeout');
lines.push('  verdict observed on the device.');
lines.push('- A controller note that is an unfilled skeleton is **not** a reviewed row.');
lines.push('- A note that describes a *different* game is **not** acceptance of this game.');
lines.push('- A historical frame never becomes a current-device row. The 22 games whose');
lines.push('  parent tasks are already checked get a fresh row here regardless — those');
lines.push('  existing checks are **not** treated as this review (task 3.21).');
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`| Status | Count |`);
lines.push(`| --- | --- |`);
for (const [k, v] of Object.entries(counts)) lines.push(`| ${k} | ${v} |`);
lines.push(`| **Total** | **${rows.length}** |`);
lines.push('');
lines.push('## Assessment');
lines.push('');
lines.push('| Domain | Game | Parent task | Identity | Review note | Status | Basis |');
lines.push('| --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  lines.push(`| ${r.domain} | \`${r.game}\` | ${r.parentTask} | ${r.identity} | ${r.note} | **${r.status}** | ${r.reason} |`);
}
lines.push('');
lines.push('## What a NOT VALIDATED row means');
lines.push('');
lines.push('It means the check did not establish the required states. It is **not** a');
lines.push('claim that the game is broken, and **not** a pass. Per the change spec a');
lines.push('parent task is checked only when its own linked evidence satisfies it, so a');
lines.push('`NOT VALIDATED` row leaves the corresponding parent task unchecked.');
lines.push('');

writeFileSync(path.join(EV, 'ASSESSMENT.md'), `${lines.join('\n')}\n`, 'utf8');
writeFileSync(
  path.join(EV, 'assessment.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), apk: 'de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d', counts, rows }, null, 2)}\n`,
  'utf8',
);
console.log('assessment rows:', rows.length);
console.log('counts:', JSON.stringify(counts));
for (const r of rows.filter((x) => x.status === 'PASS')) console.log('  PASS', r.game);
