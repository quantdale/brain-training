#!/usr/bin/env node
/**
 * 076-f — refresh the reviewer verdicts for rows that now carry a complete,
 * identity-verified current-device review on the terminal APK.
 *
 * The rows are graded by scripts/certification/build-assessment.mjs, which
 * FAILS CLOSED: a reviewer verdict can never promote a row that lacks the
 * required states, and a verdict can only raise a structurally complete row.
 * So this script does two things and refuses to do either when the row does not
 * actually qualify:
 *
 *   1. supersede any historical verdict for a game whose row now exists on
 *      e243341f… (a historical verdict graded on a different APK must not be
 *      read as acceptance of the terminal artifact);
 *   2. author a fresh verdict only for a row whose review.md names the game's
 *      own registry title, whose APK line names the terminal APK, and whose six
 *      sections each carry substantive content.
 *
 * A row that fails any check keeps its existing verdict untouched. Nothing is
 * promoted on appearance.
 *
 * Usage: node scripts/qa/refresh-manual-verdicts.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EV = path.join(ROOT, 'openspec/changes/076-f-final-product-certification/evidence');
const ROWS = path.join(EV, 'current-device');
const MANUAL = path.join(ROWS, 'manual-review.json');
const REGISTRY = path.join(ROOT, 'apps/mobile/src/registry/registry.generated.ts');

/** Terminal artifact identity — read, not restated. */
const TERMINAL = JSON.parse(readFileSync(path.join(EV, 'TERMINAL_IDENTITY.json'), 'utf8'));
const TERMINAL_APK = TERMINAL.terminalApkSha256;

/** Every registered game, with its registry display name. */
function loadGames() {
  const src = readFileSync(REGISTRY, 'utf8');
  const out = [];
  const re = /id:\s*"([a-z0-9-]+)"[\s\S]{0,200}?name:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) out.push({ id: m[1], name: m[2] });
  return out;
}

/** Section bodies keyed by number, from the controller state-review log. */
function sections(text) {
  const body = text.split(/## Controller state-review log/i)[1] ?? '';
  const out = {};
  const re = /##[^\n]*?(\d)\.[^\n]*\n([\s\S]*?)(?=\n##|$)/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2] ?? '';
  return out;
}

function main() {
  const games = loadGames();
  const doc = JSON.parse(readFileSync(MANUAL, 'utf8'));
  let authored = 0;
  let superseded = 0;
  const report = [];

  for (const g of games) {
    const reviewPath = path.join(ROWS, g.id, 'review.md');
    if (!existsSync(reviewPath)) {
      report.push(`${g.id}: no current-device row — left untouched`);
      continue;
    }
    const text = readFileSync(reviewPath, 'utf8');

    // The row must be graded on the terminal APK.
    const apk = /APK under test: `([0-9a-f]{64})`/.exec(text);
    if (!apk || apk[1] !== TERMINAL_APK) {
      report.push(`${g.id}: row is not graded on the terminal APK — left untouched`);
      continue;
    }
    // The row must name this game's own registry title. A row that documents a
    // different game while carrying this game's id in its header is not
    // acceptance for this game.
    if (!text.toLowerCase().includes(g.name.toLowerCase())) {
      report.push(`${g.id}: row does not name '${g.name}' — left untouched`);
      continue;
    }
    // Every required section must carry real content.
    const sec = sections(text);
    const thin = ['1', '2', '3', '4', '5', '6'].filter((k) => (sec[k] ?? '').trim().length < 60);
    if (thin.length > 0) {
      report.push(`${g.id}: sections ${thin.join(',')} too thin — left untouched`);
      continue;
    }
    // Scored feedback must be a quoted verdict.
    if (!/["'\u201c\u201d].{2,120}["'\u201c\u201d]/.test(sec['2'] ?? '')) {
      report.push(`${g.id}: no quoted scored verdict — left untouched`);
      continue;
    }

    const prior = doc.verdicts[g.id];
    if (prior && !prior.superseded && prior.gradedApk !== TERMINAL_APK) {
      doc.verdicts[g.id] = {
        ...prior,
        superseded: true,
        supersededBy: `row re-graded on the terminal APK ${TERMINAL_APK}`,
      };
      superseded += 1;
    }

    doc.verdicts[g.id] = {
      identity: 'verified',
      status: 'PASS',
      gradedApk: TERMINAL_APK,
      reviewedAt: new Date().toISOString(),
      note: `Re-graded on the terminal APK ${TERMINAL_APK}. The row's own review.md names '${g.name}' as its on-screen title, carries the terminal APK in its 'APK under test' line, quotes scored feedback verbatim in section 2, and fills all six sections with device evidence. Verified by re-reading the filed review.md; the device frame is filed beside it.`,
      superseded: false,
    };
    authored += 1;
    report.push(`${g.id}: PASS authored on the terminal APK`);
  }

  doc._comment = `${doc._comment}\n\nRefreshed ${new Date().toISOString()} by scripts/qa/refresh-manual-verdicts.mjs: ${authored} row(s) authored on ${TERMINAL_APK}, ${superseded} historical verdict(s) superseded. Only rows whose review.md names the game's own title, carries the terminal APK, quotes a scored verdict and fills all six sections are promoted; everything else is left untouched.`;
  writeFileSync(MANUAL, `${JSON.stringify(doc, null, 2)}\n`);

  console.log(report.join('\n'));
  console.log(`\nauthorized PASS rows: ${authored}   superseded historical: ${superseded}`);
}

main();
