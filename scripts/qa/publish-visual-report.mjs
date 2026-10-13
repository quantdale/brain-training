// Publish evidence counts from current inventories, without turning requested
// theme modes or after-only measurements into matched comparisons.
import fs from 'node:fs';
import path from 'node:path';
import { EV, loadThemeInventory, checkIndexedImage } from './theme-evidence.mjs';
import { verifyVisualEvidence, evidenceResultPassed } from './verify-visual-evidence.mjs';

const checks = verifyVisualEvidence();
if (!checks.every(evidenceResultPassed)) throw new Error('source image integrity verification failed');
for (const entry of loadThemeInventory().filter((e) => e.inventory === 'terminal-tutorials-c8c3d46c')) checkIndexedImage(entry);
const J = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const CM = J(EV + '/coverage-matrix.json');
const GL = J(EV + '/matched-gallery.json');
const themes = J(EV + '/image-themes.json');
const tutorials = J(EV + '/terminal-tutorials-c8c3d46c/manifest.json');
const before = J(EV + '/before/index.json');
const baseline = J(EV + '/before-captures/index.json');
const matrix = J(EV + '/final-matrix-de6c5fcd/captures.json');
const BT = String.fromCharCode(96);
const c = (s) => BT + s + BT;
const short = (s) => s.slice(0, 10);
const rows = CM.rows;
const by = (status) => rows.filter((row) => row.status === status);
const matched = by('MATCHED');
const routesFor = (profile) => rows.filter((row) => row.kind === 'route' && row.profile === profile);
const compactMissing = routesFor('compact').filter((row) => row.status !== 'MATCHED');
const gameResults = rows.filter((row) => row.kind === 'game' && row.surface.endsWith('/result'));

const audits = [];
for (const file of fs.readdirSync(EV + '/final-matrix-de6c5fcd/audits').sort()) {
  const audit = J(EV + '/final-matrix-de6c5fcd/audits/' + file);
  const total = { profile: file.replace(/\.json$/, ''), surfaces: audit.surfaces.length,
    interactive: 0, labelled: 0, undersized: 0, unlabelled: 0, occluded: 0 };
  for (const surface of audit.surfaces) {
    total.interactive += surface.interactive || 0; total.labelled += surface.labelled || 0;
    total.undersized += (surface.undersized || []).length; total.unlabelled += (surface.unlabelled || []).length;
    total.occluded += (surface.occluded || []).length;
  }
  audits.push(total);
}
const doc = [
  '# Campaign 076 — Visual Decision Report', '',
  '**Generated:** ' + new Date().toISOString(),
  '**Scope:** bounded cleanup of existing evidence; no production edit, new device capture, local/historical APK rebuild, ARTEMIS call, game sweep or journey certification.', '',
  '## 1. Disposition', '',
  '**Parent 14.3 remains OPEN. Its original acceptance criteria are unchanged. The release verdict remains ' + c('CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED') + '.**',
  'Parent 14.7 remains checked for publication of the coverage manifest, report, reference links and explicit gaps. Publication does not establish 14.3 acceptance.', '',
  'The previous claim of 62 theme-verified pairs is withdrawn. No committed hash-linked witness establishes the observed app theme in these inventories. Requested capture modes and image brightness cannot supply that witness. There are **' + matched.length + ' theme-confirmed matched pairs**.', '',
  '## 2. Integrity and artifact identities', '',
  '| Inventory | PNGs | Integrity check | APK / source |',
  '| --- | --- | --- | --- |',
  '| before-captures | ' + baseline.images.length + ' | recorded SHA-256 and bytes verified | ' + c(baseline.apkSha256) + ' / ' + c(baseline.sourceSha) + ' |',
  '| before routes | ' + before.images.length + ' | recorded SHA-256 and bytes verified | ' + c(before.apkSha256) + ' / ' + c(before.sourceSha) + ' |',
  '| final route matrix | ' + matrix.surfaces.length + ' | each recorded pngSha256 and pngBytes verified; PNG and per-capture identity checks | ' + c(matrix.build.apkSha256) + ' / ' + c(matrix.build.codeSha) + ' |',
  '| terminal tutorials | ' + tutorials.games.length + ' | original recorded SHA-256 and bytes verified; existing hierarchy proves intro controls | ' + c(tutorials.apkSha256) + ' / ' + c(GL.identities.afterTerminal.source) + ' |',
  '| filed game result rows | ' + gameResults.length + ' | hashes computed for indexing; no separate prior per-PNG digest asserted | identities retained from each review; ' + GL.identities.afterGameRows.apks.map(c).join(', ') + ' |', '',
  'The first four inventories total **466 PNGs** checked against prior recorded digests. The theme inventory contains **' + themes.count + ' PNGs**: those 466 plus the 42 filed result rows. The prior theme walk included unrelated certification images under a misleading 42-row label; that scope is corrected.',
  'Hash integrity verifies referenced bytes, not the claimed surface, theme or release acceptance. Historical route matrix ' + c(short(matrix.build.apkSha256)) + ' remains historical, and is not relabelled as repaired-terminal evidence. No source PNG or original recorded digest was replaced.', '',
  '## 3. Theme evidence', '',
  '| Inventory | Observed app theme | Available metadata and limit |',
  '| --- | --- | --- |',
  '| before-captures | UNKNOWN | index records bytes/hash/APK/source, no observed-theme metadata |',
  '| before routes | UNKNOWN | directory names label intended slots; original capture manifest was overwritten |',
  '| final route matrix | UNKNOWN | hash-linked surfaces[].theme records requested mode; no selected app-theme witness |',
  '| terminal tutorials | UNKNOWN | hash-linked games[].theme records requested mode; no selected app-theme witness |',
  '| filed game results | UNKNOWN | reviews carry APK identity, no observed-theme metadata |', '',
  'Mean relative luminance is retained only as a pixel diagnostic. There is no brightness threshold or filename fallback for observed theme. The old assertions that every historical board is light and every accepted row is dark are unsupported and withdrawn.',
  'A future known classification needs hash-linked observed app-theme metadata or an equivalent same-capture witness. A selected system preference also needs the corresponding OS night-mode state. Missing or conflicting evidence stays UNKNOWN.', '',
  '## 4. Coverage and unresolved candidates', '',
  c(JSON.stringify(CM.totals.byStatus)), '',
  '**' + matched.length + ' matched; ' + by('THEME-UNKNOWN').length + ' candidate comparisons with unverified themes; ' + by('AFTER-ONLY').length + ' after-only slots; ' + by('BEFORE-SURFACE-DIFFERS').length + ' historical surface differences.**',
  'The coverage matrix has ' + rows.length + ' rows. Its captureTheme field labels a declared slot; its theme field reports the observed classification. Two UNKNOWN values never establish theme agreement.', '',
  '| 14.3 condition | Confirmed matches | Existing before candidates | Remaining evidence |',
  '| --- | --- | --- | --- |',
];
for (const profile of ['default', 'fs2', 'compact']) {
  const subset = routesFor(profile);
  doc.push('| ' + profile + ' route slots | ' + subset.filter((r) => r.status === 'MATCHED').length +
    ' | ' + subset.filter((r) => r.before).length + ' (themes unverified) | ' +
    subset.filter((r) => !r.before).length + ' after-only; observed themes UNKNOWN |');
}
doc.push('| reduced-motion | 0 | 0 | no before/after screenshot profile filed; existing measurement is not a comparison |', '',
  'Tutorials: ' + GL.summary.tutorialThemeUnknown + ' former light-slot candidates are THEME-UNKNOWN; ' + GL.summary.tutorialAfterOnly + ' separately requested dark-slot stills are after-only. The historical tutorial theme is unknown, so absence of a historical dark theme is not asserted.',
  'Results: ' + GL.summary.gameResultThemeUnknown + ' standalone candidates are THEME-UNKNOWN; ' + GL.summary.gameResultBeforeMissing + ' games have only a different historical surface (workout-leg chrome). Neither uncertainty nor different surfaces may be counted as matched.', '',
  '**Compact layouts:** ' + compactMissing.length + ' unresolved surfaces, ' + compactMissing.filter((r) => r.status === 'AFTER-ONLY').length + ' after-only.',
  compactMissing.map((r) => c(r.captureTheme + '/' + r.surface)).join(', ') + '.', '',
  '**All unconfirmed route slots:**', '',
  '| Profile | Declared capture slot | Surface | Status |',
  '| --- | --- | --- | --- |');
for (const row of rows.filter((r) => r.kind === 'route' && r.status !== 'MATCHED')) {
  doc.push('| ' + row.profile + ' | ' + row.captureTheme + ' | ' + c(row.surface) + ' | ' + row.status + ' |');
}
doc.push('', '**All unconfirmed game results:**', '',
  '| Game | Status | Reason |', '| --- | --- | --- |');
for (const row of gameResults) doc.push('| ' + c(row.surface) + ' | ' + row.status + ' | ' + row.note + ' |');
doc.push('', 'Complete references and hashes: ' + c('matched-gallery.json') + ', ' + c('coverage-matrix.json') + ', ' + c('image-themes.json') + ' and ' + c('matched-image-index.md') + '.', '',
  '## 5. Existing accessibility measurements', '',
  'These are historical after-only measurements on the route-matrix APK, not matched comparisons or new certification. Counts below come from the six audit files; occluded nodes remain excluded.', '',
  '| Profile | Surfaces | Interactive | Labelled | Undersized | Unlabelled | Occluded | Violations |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const audit of audits) doc.push('| ' + [audit.profile, audit.surfaces, audit.interactive, audit.labelled, audit.undersized,
  audit.unlabelled, audit.occluded, audit.undersized + audit.unlabelled].join(' | ') + ' |');
doc.push('', 'The existing 42-game review and nine-journey certification records are unchanged and were not repeated. This cleanup does not certify clipping, contrast, hidden actions or beta readiness.', '',
  '## 6. Decision record and remaining owner decision', '',
  '- [Three-direction scorecard](proto-scorecard.md): Pocket Console 8.45, Training Studio 8.63, Puzzle Index 7.63; historical prototype decision.',
  '- [Reference lock](REFERENCE_LOCK.md): selected Training Studio direction; historical design record.', '',
  'Before a limited Android beta, the owner must authorize resolving the remaining 14.3 evidence requirements, or explicitly accept that documented visual evidence debt for the beta. Any release-verdict change needs separate authorization. No waiver, new baseline comparison or publication approval is inferred here.',
  'Historical/terminal capture acquisition remains outside this cleanup; observed-theme gaps must first be resolved before choosing any further comparisons.', '',
  '## 7. Reproducibility', '',
  'Run the source hash verifier, tutorial verifier, theme analysis, final-gallery generator, coverage generator, report publisher and theme/ledger validators in that order. All read existing artifacts; the tutorial verifier preserves the original digests. No device connection is needed.', '',
);
fs.writeFileSync(EV + '/VISUAL_DECISION.md', doc.join('\n').trimEnd() + '\n');
const index = [
  '# Matched before/after image index — Campaign 076', '',
  matched.length + ' confirmed pairs. The former 62-pair claim is withdrawn: observed themes are UNKNOWN.',
  'Unconfirmed candidates remain indexed in matched-gallery.json and coverage-matrix.json, with hashes and artifact identities; they are not counted as comparisons.', '',
  '| Kind | Surface | Confirmed theme | Before frame | After frame | APK transition |',
  '| --- | --- | --- | --- | --- | --- |',
];
for (const row of matched) index.push('| ' + [row.kind, row.surface, row.theme, row.before.file, row.after.file,
  short(row.before.apk) + ' -> ' + short(row.after.apk)].join(' | ') + ' |');
fs.writeFileSync(EV + '/matched-image-index.md', index.join('\n').trimEnd() + '\n');
console.log('Published report/index: matched=' + matched.length + ', unknown=' + by('THEME-UNKNOWN').length + ', after-only=' + by('AFTER-ONLY').length);
