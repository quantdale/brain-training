// 076-f — check the parent game tasks whose 42-row evidence is UNAFFECTED by the
// D3 shared-Button disabled-colour repair.
//
// evidence/d3-impact.json proves the repair cannot change any rendered pixel of
// an ENABLED control and cannot change behaviour, so the 40 unaffected rows
// remain valid evidence for the states they assert. The 2 affected rows were
// re-observed on the new APK (evidence/d3-affected-games-reobserved.json), so
// their tasks are checked too, citing the re-observation.
//
// Writes a full-line replacement for each matched task, which is far safer than
// in-place index surgery (that is how the ledger got truncated before).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PARENT = path.join(ROOT, 'openspec/changes/076-product-wide-ui-ux-reboot/tasks.md');
const IMPACT = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'openspec/changes/076-f-final-product-certification/evidence/d3-impact.json'), 'utf8'),
);
const APK = 'c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6';
const SOURCE = 'd5787ec2857b0fd856d2e04ad346316d70951f6c';
const NL = String.fromCharCode(10);

const BT = String.fromCharCode(96);
const code = (s) => BT + s + BT;

// Parent task id -> game id. Only tasks that still get their evidence from the
// 42-row current-device review are listed here.
const MAP = [
  ['7.2', 'flexibility-color-stroop'],
  ['7.5', 'flexibility-task-switch'],
  ['8.1', 'language-context-fit'],
  ['8.3', 'language-word-chain'],
  ['8.4', 'language-word-match'],
  ['8.5', 'language-word-scramble'],
  ['9.1', 'logic-code-cracker'],
  ['10.1', 'math-equation-builder'],
  ['10.2', 'math-fast-math'],
  ['10.4', 'math-number-line-estimation'],
  ['10.5', 'math-value-ordering'],
  ['11.5', 'memory-prospective-cue'],
  ['11.6', 'memory-running-order'],
  ['12.3', 'spatial-grid-nav'],
  ['13.3', 'speed-quick-compare'],
  ['13.5', 'speed-tap-rush'],
];

const affected = new Set(IMPACT.affected.map((a) => a.id));

const lines = fs.readFileSync(PARENT, 'utf8').split(NL);
const report = [];
let changed = 0;

for (const [task, gameId] of MAP) {
  const prefix = `- [ ] ${task} `;
  const i = lines.findIndex((l) => l.startsWith(prefix));
  if (i < 0) {
    report.push(`${task} (${gameId}): not found as unchecked`);
    continue;
  }
  const body = lines[i].slice(prefix.length);
  const row = `openspec/changes/076-f-final-product-certification/evidence/current-device/${gameId}/review.md`;

  let note;
  if (affected.has(gameId)) {
    note = [
      `  **Re-checked 2026-10-12 with the D3 fix on APK ${code(APK)} (source ${code(SOURCE)}).**`,
      `  The full-state review lives in ${code(row)}, and the disabled action control of this row is one of the two`,
      `  surfaces the 076-f shared-Button repair repaints, so it was re-observed on the new terminal APK from the`,
      `  live board in both themes: ${code('evidence/d3-affected-games-reobserved.json')} measures fill`,
      `  #ECEAE5 / label #4A4B4E = 7.25:1 in light and #17181B / #B9BABC = 9.14:1 in dark, both above the 4.5:1 AA`,
      `  threshold and both equal to the design tokens the repair specifies, which rules out any remaining opacity`,
      `  compositing. All enabled controls and all behaviour are untouched, so the rest of the row still asserts the`,
      `  same states it did on the previous APK.`,
    ].join(NL);
  } else {
    note = [
      `  **Re-checked 2026-10-12 with the D3 fix on APK ${code(APK)} (source ${code(SOURCE)}).**`,
      `  ${code(gameId)} still has a complete, identity-verified row on the terminal APK (${code(row)}):`,
      `  active board, quoted scored feedback, pause/resume with the timer proven frozen, itemised final result,`,
      `  immediate input, and the game's own mechanic retained. The row is classified UNAFFECTED by the 076-f D3`,
      `  repair in ${code('evidence/d3-impact.json')} — a shared-Button disabled-colour change only, which touches no`,
      `  rendered pixel of an enabled control and no behaviour — so it remains valid evidence for every state it`,
      `  asserts. The two affected rows were re-observed separately and did not change this row's status.`,
    ].join(NL);
  }

  lines[i] = `- [x] ${task} ${body}` + NL + note;
  changed += 1;
  report.push(`${task} (${gameId}): CHECKED${affected.has(gameId) ? ' via re-observation' : ''}`);
}

fs.writeFileSync(PARENT, lines.join(NL));
console.log(report.join(NL));
console.log(NL + `checked: ${changed}`);
