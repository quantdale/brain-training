import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ROWS = path.join(ROOT, 'openspec/changes/076-f-final-product-certification/evidence/current-device');
const OUT = path.join(ROOT, 'openspec/changes/076-f-final-product-certification/evidence/d3-impact.json');

const ids = fs.readdirSync(ROWS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name);

const SHARED_DISABLED_DESC =
  /(submit|answer|primary|cta|force|response|go button)[^\n]{0,90}(disabled|desaturat|dim dark|dim,|unauthoris|muted)/i;
// Exclude descriptions of an ENABLED control whose secondary fill is merely
// dark/grey (Resume / Quit), which is not a disabled state at all.
const ENABLED_BUTTON_DESC =
  /"(resume|quit|play again|done)"[^\n]{0,60}(red|pink|filled|primary|outlined)/i;

const affected = [];
const unaffected = [];
for (const id of ids) {
  const f = path.join(ROWS, id, 'review.md');
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  const body = t.split(/## Controller state-review log/i)[1] || '';
  const hits = body.split(/\r?\n/).filter((l) => SHARED_DISABLED_DESC.test(l) && !ENABLED_BUTTON_DESC.test(l));
  if (hits.length) affected.push({ id, lines: hits.map((l) => l.trim().slice(0, 240)) });
  else unaffected.push(id);
}

const report = {
  generatedAt: new Date().toISOString(),
  change:
    '076-f D3 — shared Button disabled treatment (fill muted to backgroundElement, label textSecondary, no whole-control opacity)',
  rowsTotal: ids.length,
  unaffectedCount: unaffected.length,
  affectedCount: affected.length,
  unaffected,
  affected,
  rationale:
    'A row is AFFECTED only when it explicitly describes the shared submit/answer ' +
    'control in a disabled-looking way, because that description was captured ' +
    'under the old opacity-collapsed treatment and is superseded. Rows that mention ' +
    'disabled/greyed/dimmed game-owned elements are UNAFFECTED: the repair touches ' +
    'no rendered pixel of an enabled control and no behaviour.',
};
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(`rows: ${report.rowsTotal}  unaffected: ${report.unaffectedCount}  affected: ${report.affectedCount}`);
for (const a of affected) {
  console.log(`--- ${a.id}`);
  for (const l of a.lines) console.log(`    ${l}`);
}
