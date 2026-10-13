// Refresh evidence commentary only. Preserve both original task requirements
// and their existing dispositions: 14.3 OPEN, 14.7 CHECKED.
import fs from 'node:fs';
import { EV } from './theme-evidence.mjs';
const file = 'openspec/changes/076-product-wide-ui-ux-reboot/tasks.md';
const cm = JSON.parse(fs.readFileSync(EV + '/coverage-matrix.json', 'utf8'));
const gl = JSON.parse(fs.readFileSync(EV + '/matched-gallery.json', 'utf8'));
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const BT = String.fromCharCode(96);
const c = (value) => BT + value + BT;
function replaceComment(id, checked, block) {
  const index = lines.findIndex((line) => line.startsWith('- [' + (checked ? 'x' : ' ') + '] ' + id + ' '));
  if (index < 0) throw new Error('unexpected disposition for task ' + id);
  let end = index + 1;
  // Older generated commentary contains an accidentally unindented count line.
  // A task owns its whole block through the next task/section, not indentation.
  while (end < lines.length && !/^(?:- \[[ x]\] |## )/.test(lines[end])) end++;
  lines.splice(index + 1, end - index - 1, ...block.map((line) => line ? '  ' + line : ''), '');
}
const count = (status) => cm.rows.filter((row) => row.status === status).length;
replaceComment('14.3', false, [
  '**Still OPEN — evidence-integrity correction 2026-10-13. Original criteria unchanged.**',
  'The earlier 62 theme-verified pairs and 38 theme-mismatched results were based on',
  'mean luminance; those classifications are withdrawn. No committed hash-linked',
  'observed app-theme witness exists in these inventories. Requested capture modes',
  'and directory names are not observed theme; uncertain frames are UNKNOWN.',
  '',
  'The refreshed ' + c('evidence/coverage-matrix.json') + ' has ' + cm.totals.rows + ' rows:',
  count('MATCHED') + ' MATCHED, ' + count('THEME-UNKNOWN') + ' THEME-UNKNOWN, ' +
    count('AFTER-ONLY') + ' AFTER-ONLY, ' + count('BEFORE-SURFACE-DIFFERS') + ' BEFORE-SURFACE-DIFFERS.',
  'The ' + gl.summary.routeThemeUnknown + ' route, ' + gl.summary.tutorialThemeUnknown + ' tutorial and ' + gl.summary.gameResultThemeUnknown +
    ' standalone-result candidates retain their hashes/identities but cannot count as comparisons.',
  'Four games have only a different workout-leg before surface; no equivalence is fabricated.',
  '',
  '| Condition | Confirmed matches | Remaining evidence |',
  '| --- | --- | --- |',
  '| default light/dark | 0 | 16 route candidates with UNKNOWN themes; 14 after-only slots |',
  '| dark/light 2x text | 0 | 4 route candidates with UNKNOWN themes; 26 after-only slots |',
  '| compact/large | 0 | 30 after-only route slots; no historical before profile |',
  '| reduced-motion | 0 | no before/after screenshot profile; existing measurement only |',
  '',
  '466 PNGs (272 historical states, 20 historical routes, 90 matrix routes and',
  '84 existing tutorials) were checked against their original recorded hashes/bytes.',
  'The theme inventory additionally includes 42 filed result rows with computed',
  'hashes, not claimed prior-digest verification: 508 frames, observed themes UNKNOWN.',
  'Hash integrity does not establish state, theme or acceptance. Existing after-only',
  'accessibility measurements remain historical and were not recertified.',
  '',
  'Full detail and exact slots: ' + c('evidence/VISUAL_DECISION.md') + '.',
  'Before a limited Android beta the owner must authorize resolving this evidence',
  'debt or explicitly accept it for that beta. No waiver or release-verdict change',
  'is inferred. No production edits, local/historical APK rebuild, new captures,',
  'ARTEMIS calls, 42-game sweep or nine-journey certification occurred in this cleanup.',
]);
replaceComment('14.7', true, [
  '**Remains checked — publication corrected 2026-10-13 without claiming acceptance.**',
  'Coverage status: ' + c('evidence/coverage-matrix.json') + ' (' + cm.totals.rows + ' rows); visual report:',
  c('evidence/VISUAL_DECISION.md') + '; image references: ' + c('evidence/matched-gallery.json') +
    ' and ' + c('evidence/matched-image-index.md') + '.',
  'The old 62-pair claim is withdrawn; the matched index now has 0 confirmed pairs.',
  'Unknown candidates, after-only slots and different before surfaces remain explicit.',
  'All 42 games retain a result status and filed review; no missing comparison is fabricated.',
  'The three-direction decision record remains ' + c('evidence/proto-scorecard.md') +
    ' (A 8.45, B 8.63, C 7.63), with ' + c('evidence/REFERENCE_LOCK.md') + '.',
  'Historical baseline, route matrix, repaired-terminal tutorial and per-game APK',
  'identities remain separate and unchanged. Residual debt: report, 076-f',
  c('evidence/DEFECTS_CURRENT.md') + ' and ' + c('evidence/VERDICT.md') + '.',
  'Publication does not close 14.3; verdict remains ' + c('CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED') + '.',
]);
fs.writeFileSync(file, lines.join('\n'));
console.log('Updated commentary; parent 14.3 OPEN / 14.7 CHECKED; criteria preserved');
