// Confirm both task ledgers are internally consistent after the correction pass.
import fs from 'node:fs';
const NL = String.fromCharCode(10);
const count = (p, box) => fs.readFileSync(p, 'utf8').split(NL).filter((l) => l.startsWith(`- [${box}] `)).length;

const F = 'openspec/changes/076-f-final-product-certification/tasks.md';
const P = 'openspec/changes/076-product-wide-ui-ux-reboot/tasks.md';
for (const [name, p] of [['076-f', F], ['parent 076', P]]) {
  console.log(`${name}: checked=${count(p, 'x')} unchecked=${count(p, ' ')}`);
}
const open = fs.readFileSync(P, 'utf8').split(NL).filter((l) => l.startsWith('- [ ] '));
console.log('\nopen parent tasks:');
for (const l of open) console.log('  ' + l.slice(0, 72));

// A claim is only stale if it is present WITHOUT its dated correction
// immediately following it. The corrections append rather than replace, so the
// original claim stays visible as history and must remain present.
const stale = [];
const text = fs.readFileSync(F, 'utf8');
const adjacent = (claim, marker) => {
  const i = text.indexOf(claim);
  return i >= 0 && text.slice(i, i + 900).includes(marker);
};
if (!adjacent('Parent task 14.3 is therefore checked', 'Corrected 2026-10-13')) stale.push('076-f 5.3 claims 14.3 checked with no adjacent correction');
if (!adjacent('14.7 — LEFT UNCHECKED.', 'superseded 2026-10-13')) stale.push('076-f 8.1 lists 14.7 unchecked with no adjacent correction');
if (!adjacent('Parent 14.3 is checked from the 076-f side', 'Corrected 2026-10-13')) stale.push('076-f 8.1 14.3 claim has no adjacent correction');
if (!adjacent('parent 14.3, 14.7', 'Updated 2026-10-13')) stale.push('076-f 8.5 verdict reason has no adjacent correction');
console.log('\nstale claims found: ' + stale.length);
for (const x of stale) console.log('  ' + x);
const corrected = text.split('Corrected 2026-10-13').length - 1 + text.split('Updated 2026-10-13').length - 1;
console.log('dated corrections present: ' + corrected);
process.exit(stale.length ? 1 : 0);
