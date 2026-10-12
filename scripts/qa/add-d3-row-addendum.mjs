// Append a D3 re-observation addendum to the two 42-rows whose disabled submit
// control the 076-f shared-Button repair repaints. The addendum states the new
// APK identity, the measured contrast in both themes, and that the rest of the
// row still holds, rather than silently rewriting the captured review log.
import fs from 'node:fs';
import path from 'node:path';

const NL = String.fromCharCode(10);
const BT = String.fromCharCode(96);
const code = (s) => BT + s + BT;
const EV = 'openspec/changes/076-f-final-product-certification/evidence/current-device';

const ROWS = [
  {
    id: 'language-word-scramble',
    control: 'language-word-scramble.submit',
    label: 'Submit',
    bounds: '[97,1221][983,1347]',
    light: { fill: '#ECEAE5', label: '#4A4B4E', c: '7.25:1' },
    dark: { fill: '#17181B', label: '#B9BABC', c: '9.14:1' },
  },
  {
    id: 'logic-code-cracker',
    control: 'logic-code-cracker.submit-guess',
    label: 'Submit guess',
    bounds: '[97,968][983,1094]',
    light: { fill: '#ECEAE5', label: '#4A4B4E', c: '7.25:1' },
    dark: { fill: '#17181B', label: '#B9BABC', c: '9.14:1' },
  },
];

for (const r of ROWS) {
  const f = path.join(EV, r.id, 'review.md');
  if (!fs.existsSync(f)) {
    console.error(`missing ${f}`);
    process.exit(1);
  }
  const addendum = [
    '',
    '## 2026-10-12 addendum — 076-f D3 disabled-control re-observation',
    '',
    `The disabled action control above is one of the two 42-row surfaces that`,
    `change 076-f's shared-Button repair actually repaints, so it was`,
    `re-observed on the new terminal APK`,
    `${code('c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6')}`,
    `(48,888,528 bytes, source ${code('d5787ec2857b0fd856d2e04ad346316d70951f6c')}), read`,
    `straight off the live board from the accessibility hierarchy`,
    `(${code(r.control)} [${r.label}], enabled=false, bounds ${r.bounds}).`,
    '',
    'Decoding the device screenshot and computing WCAG 2.x contrast between the',
    "control's fill and its label glyphs:",
    '',
    `- light: fill ${r.light.fill}, label ${r.light.label} — ${r.light.c}`,
    `- dark: fill ${r.dark.fill}, label ${r.dark.label} — ${r.dark.c}`,
    '',
    `Both are above the 4.5:1 AA threshold and both equal the tokens the`,
    `repair specifies (backgroundElement / textSecondary), which is the`,
    `pixel-level proof that the whole-control ${code('opacity: 0.5')} collapse is`,
    `gone; the previous collapse sat near 1.63:1. The label glyph count is`,
    `identical across the two themes for the same control, which confirms the`,
    `measurement is reading the text and not antialiasing.`,
    '',
    'Evidence:',
    `${code('openspec/changes/076-f-final-product-certification/evidence/d3-affected-games-reobserved.json')}`,
    '',
    'Every other state asserted in this row — the active board, the quoted',
    'scored feedback, pause/resume with the timer proven frozen, the itemised',
    'final result, immediate input, and the game\'s own mechanic — is asserted',
    `about ENABLED controls, which the repair does not repaint, and about`,
    'behaviour, which it does not touch. Those assertions therefore still hold',
    'unchanged on this new APK; only the disabled-control appearance above is',
    'superseded.',
    '',
    '## Addendum verdict',
    '',
    `Row still PASS on ${code('c8c3d46c')} — the superseded disabled-control appearance`,
    'has been replaced with measured, token-exact, AA-passing evidence in both',
    'themes.',
    '',
  ].join(NL);
  fs.appendFileSync(f, addendum);
  console.log(`${r.id}: addendum appended (${addendum.length} chars)`);
}
