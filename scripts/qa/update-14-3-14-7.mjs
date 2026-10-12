// Rewrite the disposition of parent tasks 14.3 and 14.7 against the actual
// measured coverage matrix.
//
// 14.7 is checked: every element it names is now published.
// 14.3 stays open: the conditions needing a matched comparison that has no
// historical before profile are named exactly, and the criteria are not rewritten.
import fs from 'node:fs';
import path from 'node:path';

const PARENT = 'openspec/changes/076-product-wide-ui-ux-reboot/tasks.md';
const CM = JSON.parse(fs.readFileSync('openspec/changes/076-product-wide-ui-ux-reboot/evidence/coverage-matrix.json', 'utf8'));
const NL = String.fromCharCode(10);
const BT = String.fromCharCode(96);
const code = (s) => BT + s + BT;

const rows = CM.rows;
const missingFor = (p, t) => rows.filter((r) => r.kind === 'route' && r.profile === p && r.theme === t && r.status !== 'MATCHED').map((r) => r.surface);
const compactMissing = rows.filter((r) => r.kind === 'route' && r.profile === 'compact' && r.status !== 'MATCHED').map((r) => `${r.theme}/${r.surface}`);
const themeMismatch = rows.filter((r) => r.status === 'THEME-MISMATCHED').map((r) => r.surface);
const surfaceDiffers = rows.filter((r) => r.status === 'BEFORE-SURFACE-DIFFERS').map((r) => r.surface);
const matched = rows.filter((r) => r.status === 'MATCHED');

const lines = fs.readFileSync(PARENT, 'utf8').split(NL);

function replaceTask(id, newBlock) {
  const i = lines.findIndex((l) => l.startsWith(`- [ ] ${id} `) || l.startsWith(`- [x] ${id} `));
  if (i < 0) throw new Error(`task ${id} not found`);
  // Consume the indented continuation lines belonging to this task.
  let j = i + 1;
  while (j < lines.length && (lines[j] === '' || /^ {2}\S/.test(lines[j]))) j++;
  lines.splice(i + 1, j - i - 1, newBlock);
  return i;
}

// --- 14.3: stays unchecked, gaps named exactly ------------------------------
const r143 = [
  '  **Still OPEN, with the exact missing pairs now named instead of approximated.**',
  '  The measured coverage matrix is ' + code('evidence/coverage-matrix.json') + ' (216 rows);',
  '  full reasoning in ' + code('evidence/VISUAL_DECISION.md') + '.',
  '',
  '  **What now exists as a genuine matched comparison (theme-verified from measured mean',
  '  luminance, not from a path): ' + matched.length + ' pairs** — 20 route pairs',
  '  (8 routes x default light/dark, plus 4 routes x 2x-text light) and 42 game',
  '  tutorial pairs, the latter collected as static frames on the repaired terminal APK',
  '  ' + code('c8c3d46c…') + ' with zero ARTEMIS calls. 466 source images were verified by',
  '  SHA-256 and APK identity before any pair was formed; none was missing or rehashed.',
  '',
  '  **Why it still cannot be checked.** The task requires matched matrices for four',
  '  conditions, and only two of them have a historical before profile at all:',
  '',
  '  | 14.3 condition | Matched before profile | Matched pairs | Exact missing surfaces |',
  '  | --- | --- | --- | --- |',
  '  | default light/dark | yes | 20 route pairs | ' + missingFor('default', 'light').length + ' light + ' + missingFor('default', 'dark').length + ' dark surfaces after-only |',
  '  | 2x text | yes, light only | 4 route pairs (light) | ' + missingFor('fs2', 'light').length + ' light + ' + missingFor('fs2', 'dark').length + ' dark surfaces after-only |',
  '  | compact/large | **no** | 0 | all ' + compactMissing.length + ' surfaces after-only |',
  '  | reduced-motion | **no** | 0 | no before profile **and no images on either side** |',
  '',
  '  The compact and reduced-motion before profiles do not exist and cannot be created',
  '  without rebuilding the pre-redesign baseline ' + code('d631ab9a…') + ' from source ' + code('d3d0b99'),
  '  (owner-excluded) or rerunning a historical capture campaign that no longer exists.',
  '  Reduced-motion additionally has no screenshots at all on either side — it exists only',
  '  as a measurement (30 surfaces, 0 violations).',
  '',
  '  **The measured second half of this task is satisfied and is an after-only PASS that is',
  '  never presented as a matched comparison:** 90 surfaces / 380 interactive controls /',
  '  380 labelled / 0 undersized / 0 unlabelled / 0 violations across default, compact and',
  '  2x, light and dark, with 32 occluded nodes excluded from the pass count rather than',
  '  passed.',
  '',
  '  **Representative gameplay.** No game board result frame can be paired, and the reason',
  '  is measured rather than guessed: every historical board is light and every accepted',
  '  game row is dark. ' + themeMismatch.length + ' games are theme-mismatched and',
  '  ' + surfaceDiffers.length + ' more have no standalone before result — their only historical frame is a',
  '  workout-leg result, a different surface. Closing this needs the excluded baseline',
  '  rebuild or a light-theme terminal capture that requires completed gameplay.',
  '',
  '  Checking this task on the measurement evidence alone would over-claim, so it stays',
  '  open. The criteria were not rewritten to fit the available evidence.',
].join(NL);

// --- 14.7: checked ----------------------------------------------------------
const r147 = [
  '  **Checked 2026-10-13 with linked evidence.** Every element this task names is now',
  '  published:',
  '',
  '  - **Per-game/route status:** ' + code('evidence/coverage-matrix.json') + ' — 216 rows, one per',
  '    surface, each classified MATCHED (' + matched.length + '), AFTER-ONLY (' + rows.filter((r) => r.status === 'AFTER-ONLY').length + '), THEME-MISMATCHED (',
  themeMismatch.length + ') or BEFORE-SURFACE-DIFFERS (' + surfaceDiffers.length + '), with both APK',
  '    identities per row. The per-game review ledger remains ' + code('assessment.json') + ' PASS 42.',
  '  - **Visual decision report:** ' + code('evidence/VISUAL_DECISION.md') + ', which states the',
  '    decision, the verification performed before pairing, the matched pairs, the',
  '    after-only observations and the residual gaps.',
  '  - **Matched images:** ' + code('evidence/matched-gallery.json') + ' and',
  '    ' + code('evidence/matched-image-index.md') + ' — ' + matched.length + ' indexable pairs, each theme-verified.',
  '  - **3-direction scorecard:** ' + code('evidence/proto-scorecard.md') + ' (A 8.45, B 8.63,',
  '    C 7.63; Training Studio selected; 66 hashed device captures in ' + code('proto-captures/') + ').',
  '  - **Reference lock:** ' + code('evidence/REFERENCE_LOCK.md') + '.',
  '  - **APK SHA:** three identities preserved and never relabelled — before',
  '    ' + code('d631ab9a…') + ', post-redesign matrix ' + code('de6c5fcd…') + ', terminal ' + code('c8c3d46c…'),
  '    (the last read from the installed ' + code('base.apk') + ' on the device, not assumed).',
  '  - **Residual debt / explicit gaps:** named in ' + code('VISUAL_DECISION.md') + ' §6 as the',
  '    exact missing surfaces, plus 076-f ' + code('DEFECTS_CURRENT.md') + ' and ' + code('VERDICT.md') + '.',
  '',
  '  **No game is missing a status.** All 42 have a row, a review and a terminal-APK frame;',
  '  ' + matched.length + ' additionally have a matched before frame. No completeness is claimed where',
  '  it does not exist: the report states plainly that the game-result frames are not',
  '  pairable and why. The scorecard and reference lock are linked as the decision',
  '  records they are, dated before the terminal APK, rather than restated as',
  '  current-APK evidence.',
].join(NL);

replaceTask('14.3', r143);
replaceTask('14.7', r147);

// 14.7's own acceptance criteria are every one of the elements above, and each is
// now published, so the box is checked. 14.3 is deliberately NOT checked: its
// criteria require matched matrices for compact and reduced-motion, which have no
// historical before profile, and the criteria are not rewritten to fit.
const i147 = lines.findIndex((l) => l.startsWith('- [ ] 14.7 '));
if (i147 >= 0) lines[i147] = '- [x] ' + lines[i147].slice(6);
else if (!lines.some((l) => l.startsWith('- [x] 14.7 '))) throw new Error('14.7 line not found');

fs.writeFileSync(PARENT, lines.join(NL));
const checked = lines.filter((l) => l.startsWith('- [x] ')).length;
const unchecked = lines.filter((l) => l.startsWith('- [ ] ')).length;
console.log(`parent ledger: ${checked} checked / ${unchecked} unchecked`);
console.log('14.3 line:', lines.find((l) => l.startsWith('- [') && l.includes(' 14.3 ')).slice(0, 60));
console.log('14.7 line:', lines.find((l) => l.startsWith('- [') && l.includes(' 14.7 ')).slice(0, 60));
