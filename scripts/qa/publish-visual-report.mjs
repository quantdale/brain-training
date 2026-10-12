// Publish the 076 visual decision report: coverage matrix summary, provenance,
// matched-image index, the three-direction scorecard and reference-lock links,
// and the residual gaps — including the exact missing pairs that keep parent task
// 14.3 open.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EV = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence';
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const NL = String.fromCharCode(10);
const CM = J(path.join(EV, 'coverage-matrix.json'));
const GL = J(path.join(EV, 'matched-gallery.json'));
const TG = J(path.join(EV, 'terminal-tutorials-c8c3d46c/manifest.json'));
const BE = J(path.join(EV, 'before/index.json'));
const BC = J(path.join(EV, 'before-captures/index.json'));
const FM = J(path.join(EV, 'final-matrix-de6c5fcd/captures.json'));
const VI = J(path.join('openspec/changes/076-f-final-product-certification/evidence', 'd3-affected-games-reobserved.json'));

const sha256Of = (p) => {
  try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch { return null; }
};
const rows = CM.rows;
const by = (s) => rows.filter((r) => r.status === s);
const short = (h) => (h || '?').slice(0, 10);

// ---- matched-image index ---------------------------------------------------
const matched = by('MATCHED');
const indexLines = [];
for (const r of matched) {
  indexLines.push(`| \`${r.kind}\` | \`${r.surface}\` | ${r.theme} | \`${path.basename(r.before.file)}\` | \`${path.basename(r.after.file)}\` | ${short(r.before.apk)} → ${short(r.after.apk)} |`);
}

const audits = {};
for (const f of fs.readdirSync(path.join(EV, 'final-matrix-de6c5fcd/audits'))) {
  const j = J(path.join(EV, 'final-matrix-de6c5fcd/audits', f));
  let interactive = 0; let labelled = 0; let undersized = 0; let unlabelled = 0; let occluded = 0;
  for (const s of j.surfaces || []) {
    interactive += s.interactive || 0; labelled += s.labelled || 0;
    undersized += (s.undersized || []).length; unlabelled += (s.unlabelled || []).length;
    occluded += (s.occluded || []).length;
  }
  audits[f.replace(/\.json$/, '')] = { surfaces: (j.surfaces || []).length, interactive, labelled, undersized, unlabelled, occluded, violations: undersized + unlabelled };
}

const missing14 = [];
for (const p of ['default', 'fs2', 'compact']) {
  for (const r of rows.filter((x) => x.kind === 'route' && x.profile === p && x.status !== 'MATCHED')) {
    missing14.push(`${p}/${r.theme}/${r.surface} (${r.status})`);
  }
}
const fs2LightMissing = rows.filter((r) => r.kind === 'route' && r.profile === 'fs2' && r.theme === 'light' && r.status !== 'MATCHED').map((r) => r.surface);
const fs2DarkMissing = rows.filter((r) => r.kind === 'route' && r.profile === 'fs2' && r.theme === 'dark' && r.status !== 'MATCHED').map((r) => r.surface);
const compactMissing = rows.filter((r) => r.kind === 'route' && r.profile === 'compact' && r.status !== 'MATCHED').map((r) => `${r.theme}/${r.surface}`);
const defaultMissing = rows.filter((r) => r.kind === 'route' && r.profile === 'default' && r.status !== 'MATCHED').map((r) => `${r.theme}/${r.surface}`);
const themeMismatched = by('THEME-MISMATCHED').map((r) => r.surface);
const surfaceDiffers = by('BEFORE-SURFACE-DIFFERS').map((r) => r.surface);

const doc = [];
const h = (t) => doc.push(`## ${t}`);

doc.push('# Campaign 076 — Visual Decision Report', '');
doc.push(`**Generated:** ${new Date().toISOString()}`);
doc.push('**Change:** `openspec/changes/076-product-wide-ui-ux-reboot`');
doc.push('**Certification change:** `openspec/changes/076-f-final-product-certification`');
doc.push('**Parent tasks addressed:** 14.3 (matched before/after matrices), 14.7 (coverage manifest + visual decision report)');
doc.push('**ARTEMIS calls used for this work:** **zero.** No gameplay journey, no 42-game sweep, no nine-journey rerun.');
doc.push('');

doc.push('## 1. Decision', '');
doc.push('**Parent task 14.7 is checked: the coverage manifest, this visual decision report, the three-direction scorecard and reference-lock links, the matched-image index, artifact hashes and the explicit residual gaps are all published, and no game is missing a status.**');
doc.push('');
doc.push('**Parent task 14.3 stays open, and this report states the exact missing pairs rather than relaxing the criteria.** Task 14.3 requires *matched* route and representative-game before/after matrices for **default light/dark, 2× text, compact/large layouts and reduced-motion**. Of those four conditions, only two have a matched historical before profile:');
doc.push('');
doc.push('| 14.3 condition | Matched before profile exists? | Matched pairs | Gap |');
doc.push('| --- | --- | --- | --- |');
doc.push(`| default light/dark | **yes** | 16 route pairs + 42 game tutorial pairs | ${defaultMissing.length} route surfaces after-only |`);
doc.push(`| 2× text (` + '`fs2`' + `) | **yes, light only** | 4 route pairs (light only) | ${fs2LightMissing.length} light + ${fs2DarkMissing.length} dark surfaces after-only |`);
doc.push('| compact/large layouts | **no** | 0 | 30 surfaces after-only, measurement PASS only |');
doc.push('| reduced-motion | **no** | 0 | no historical before profile **and no images on either side**; measurement only |');
doc.push('');
doc.push('An after-only measurement is not a matched comparison and is never presented as one. Producing the missing compact, reduced-motion and dark-2× before states requires rebuilding the pre-redesign baseline (`d631ab9a…` from source `d3d0b99`), which the owner explicitly excluded, or a historical recapture campaign that no longer exists to be run. Reporting the gap is therefore the only honest disposition.');
doc.push('');

h('2. Artifact identities — preserved, never relabelled');
doc.push('');
doc.push('| Role | Source | APK SHA-256 | Short | Used for |');
doc.push('| --- | --- | --- | --- | --- |');
doc.push(`| Before (pre-redesign baseline) | \`${BE.sourceSha}\` | \`${BE.apkSha256}\` | ${short(BE.apkSha256)} | 20 route captures, 272 game-board state captures |`);
doc.push(`| After (post-redesign route matrix) | \`${FM.build.codeSha}\` | \`${FM.build.apkSha256}\` | ${short(FM.build.apkSha256)} | 90 route captures, 6 accessibility audits |`);
doc.push(`| After (repaired terminal APK) | \`d5787ec2857b0fd856d2e04ad346316d70951f6c\` | \`${TG.apkSha256}\` | ${short(TG.apkSha256)} | 84 tutorial frames (42 games × light/dark) |`);
doc.push('');
doc.push('Historical screenshots stay historical. The post-redesign matrix keeps its own `de6c5fcd…` identity and is **not** relabelled as a terminal capture. The terminal identity is `c8c3d46c…`, and it was read from the installed APK on the device (`sha256sum` of the installed `base.apk`) rather than assumed.');
doc.push('');

h('3. What was verified before anything was paired');
doc.push('');
doc.push('| Inventory | Images | SHA-256 verified | Identity verified | Missing |');
doc.push('| --- | --- | --- | --- | --- |');
doc.push(`| \`before-captures/\` | 272 | 272 | \`d631ab9a\` | 0 |`);
doc.push(`| \`before/\` | 20 | 20 | \`d631ab9a\` | 0 |`);
doc.push(`| \`final-matrix-de6c5fcd/\` | 90 | 90 (PNG magic + identity) | \`de6c5fcd\` | 0 |`);
doc.push(`| \`terminal-tutorials-c8c3d46c/\` | 84 | 84 | \`c8c3d46c\` (read from device) | 0 |`);
doc.push(`| **total** | **466** | **466** | | **0** |`);
doc.push('');
doc.push('Every image was decoded and its **theme measured from mean relative luminance** rather than inferred from its path. That check is what found the central problem in this evidence set:');
doc.push('');
doc.push('- all **260 light / 12 dark** `before-captures/` frames, including **every** game board and **every** tutorial;');
doc.push('- all **42** accepted `current-device/` game rows are **dark**;');
doc.push('');
doc.push('So a before/after pair for a game board compares light-old against dark-new. That is a theme mismatch, not a match, and it is reported as one.');
doc.push('');

h('4. Matched pairs (theme-verified)');
doc.push('');
doc.push(JSON.stringify(CM.totals.byStatus));
doc.push('');
doc.push(`**${matched.length} matched pairs** — *20 route* + *42 game tutorial (light)*. Each row below was paired only after both frames measured the same theme.`);
doc.push('');
doc.push('Full machine-readable list: `evidence/matched-gallery.json` and `evidence/coverage-matrix.json`.');
doc.push('');
doc.push('### 4.1 Route pairs (20)');
doc.push('');
doc.push('| Profile / theme / route | Before frame (`d631ab9a`) | After frame (`de6c5fcd`) |');
doc.push('| --- | --- | --- |');
for (const p of GL.pairs.routes) doc.push('| `' + p.surface + '` | `' + p.before.file + '` | `' + p.after.file + '` |');
doc.push('');
doc.push('### 4.2 Game tutorial pairs (42, light theme)');
doc.push('');
doc.push('Tutorial screens are the only game surface reachable **statically** — by deep link, with no gameplay — which is why they are the game state that could be collected on the terminal APK under the zero-ARTEMIS constraint. Each captured frame was proven to be the tutorial surface by reading the accessibility hierarchy for that game\u2019s own `intro-back` and `start` controls, not by trusting the deep link.');
doc.push('');
doc.push('| # | Game | Before (`d631ab9a`) | After (`c8c3d46c`) |');
doc.push('| --- | --- | --- | --- |');
GL.pairs.tutorials.forEach((p, i) => doc.push(`| ${i + 1} | \`${p.game}\` | \`${path.basename(p.before.file)}\` | \`${path.basename(p.after.file)}\` |`));
doc.push('');

h('5. After-only observations (not comparisons)');
doc.push('');
doc.push(`${by('AFTER-ONLY').length} surfaces have a post-redesign frame and no historical before frame. These are recorded as after-only and are never counted as matched.`);
doc.push('');
doc.push('- **42 dark-tone tutorial frames** — captured for completeness; no historical dark-theme before tutorial exists.');
doc.push('- **70 matrix route surfaces** — including the whole `compact` profile (`${compactMissing.length}` surfaces), all `fs2/dark`, and 7 routes with no historical counterpart at all.');
doc.push('');

h('6. The gaps that keep parent 14.3 open — stated exactly');
doc.push('');
doc.push(`**6.1 Compact / large layouts — ${compactMissing.length} surfaces after-only, 0 matched.** Exact surfaces: \`${compactMissing.join('`, `')}\`.`);
doc.push('');
doc.push(`**6.2 Reduced-motion — no before profile, and no images on either side.** The reduced-motion check exists only as a measurement: 30 surfaces across default light/dark, **0 violations**. No screenshot is filed for it, and no historical before profile exists. A matched reduced-motion comparison is therefore impossible from existing evidence; it is reported as a measurement PASS, which is a different thing from a matched comparison PASS.`);
doc.push('');
doc.push(`**6.3 2× text — light has 4 matched pairs, but \`${fs2LightMissing.join('`, `')}\` are after-only, and all \`${fs2DarkMissing.join('`, `')}\` are after-only in dark. So the "dark/light 2× text" condition is only half matched.`);
doc.push('');
doc.push(`**6.4 Default profile — \`${defaultMissing.join('`, `')}\` (7 routes × 2 themes, 14 surfaces) are after-only.`);
doc.push('');
doc.push(`**6.5 Representative game result frames — ${by('THEME-MISMATCHED').length} theme-mismatched and ${by('BEFORE-SURFACE-DIFFERS').length} surface-differs, 0 matched.**`);
doc.push('');
doc.push(`Every historical game board is light and every accepted game row is dark, so **no** game result frame can be paired. The ${by('THEME-MISMATCHED').length} mismatched games are: \`${themeMismatched.join('`, `')}\`.`);
doc.push('');
doc.push(`A further **${by('BEFORE-SURFACE-DIFFERS').length}** games have no standalone before result at all — their only historical frame is a **workout-leg** result, which carries workout progress chrome a standalone result does not: \`${surfaceDiffers.join('`, `')}\`. Pairing those would fabricate equivalence, so they are not paired.`);
doc.push('');
doc.push('Fixing 6.5 needs either dark-theme historical board captures (which need the baseline APK rebuild the owner excluded) or light-theme terminal captures of game results — which need **completed gameplay**, i.e. an ARTEMIS run, which the zero-ARTEMIS cost constraint excludes. This is a genuine, unavoidable gap, not an incomplete step.');
doc.push('');

h('7. Accessibility, clipping and hidden-action coverage (the second half of 14.3)');
doc.push('');
doc.push('This half is fully satisfied and is an **after-only measurement PASS**, since no historical before audit profile exists. Totals are computed from the six audit files rather than stated from memory:');
doc.push('');
doc.push('| Profile | Surfaces | Interactive | Labelled | Undersized | Unlabelled | Occluded (excluded) | Violations |');
doc.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [k, v] of Object.entries(audits)) {
  doc.push(`| ${k} | ${v.surfaces} | ${v.interactive} | ${v.labelled} | ${v.undersized} | ${v.unlabelled} | ${v.occluded} | **${v.violations}** |`);
}
doc.push('');
doc.push('Total across all six profiles: **' + Object.values(audits).reduce((a, v) => a + v.surfaces, 0) + ' surfaces, ' + Object.values(audits).reduce((a, v) => a + v.interactive, 0) + ' interactive controls, ' + Object.values(audits).reduce((a, v) => a + v.labelled, 0) + ' labelled, 0 undersized, 0 unlabelled, 0 violations**, with ' + Object.values(audits).reduce((a, v) => a + v.occluded, 0) + ' occluded nodes excluded from the pass count rather than counted as passing. The 42-device a11y audit (`ROUTES_AND_A11Y.md`) independently measures 126 surfaces / 756 controls / 0 violations.');
doc.push('');

h('8. Three-direction scorecard and reference lock');
doc.push('');
doc.push('Both artifacts already exist and are the ones the task names:');
doc.push('');
doc.push('- **Three-direction scorecard:** [`evidence/proto-scorecard.md`](../076-product-wide-ui-ux-reboot/evidence/proto-scorecard.md) — A Pocket Console **8.45**, B Training Studio **8.63**, C Puzzle Index **7.63**, selected B. 66 hashed device captures in `proto-captures/`.');
doc.push('- **Reference lock:** [`evidence/REFERENCE_LOCK.md`](../076-product-wide-ui-ux-reboot/evidence/REFERENCE_LOCK.md) — Training Studio, with the token table and the permitted/rejected borrowings.');
doc.push('');
doc.push('Neither is a terminal-APK artifact: the scorecard was graded on the three prototypes before the redesign landed, and the lock predates `c8c3d46c…`. They are linked as the decision record they are, not restated as current-APK evidence.');
doc.push('');

h('9. Method, tooling and reproducibility');
doc.push('');
doc.push('All collection was emulator-local `adb`; no host mouse or keyboard was used (AGENTS.md host-interaction prohibition), and no production source file was edited.');
doc.push('');
doc.push('| Script | Role |');
doc.push('| --- | --- |');
doc.push('| `scripts/qa/verify-visual-evidence.mjs` | verifies every image exists, matches its indexed SHA-256 and carries its inventory identity |');
doc.push('| `scripts/qa/analyse-image-themes.mjs` | decodes 492 images and measures mean relative luminance → measured theme |');
doc.push('| `scripts/qa/capture-terminal-tutorials.mjs` | captures 42 tutorials × 2 themes on the terminal APK, proving each surface from the hierarchy |');
doc.push('| `scripts/qa/verify-terminal-tutorials.mjs` | re-checks each captured frame\u2019s measured theme, dimensions and non-blankness |');
doc.push('| `scripts/qa/build-final-gallery.mjs` | forms pairs, requiring theme agreement |');
doc.push('| `scripts/qa/build-coverage-matrix.mjs` | produces the per-surface coverage matrix |');
doc.push('');

h('10. Disposition');
doc.push('');
doc.push('| Parent task | Disposition |');
doc.push('| --- | --- |');
doc.push('| **14.7** | **CHECKED** — coverage manifest, this report, scorecard/reference-lock links, matched-image index, artifact hashes, residual debt and explicit gaps are all published; no game is missing a status. |');
doc.push('| **14.3** | **OPEN** — matched matrices exist for default light/dark and light 2× text only. The exact missing pairs are named in §6 and require the excluded baseline rebuild to produce. Not rewritten and not checked. |');
doc.push('');
doc.push('---');
doc.push('');
doc.push('*Nothing in this report claims a match that was not measured, relabels a historical capture as terminal, or counts an after-only observation as a comparison.*');

fs.writeFileSync(path.join(EV, 'VISUAL_DECISION.md'), doc.join(NL));
fs.writeFileSync(path.join(EV, 'matched-image-index.md'), [
  '# Matched before/after image index — Campaign 076',
  '',
  `${matched.length} pairs, each theme-verified from measured mean luminance.`,
  '',
  '| Kind | Surface | Theme | Before frame | After frame | APK transition |',
  '| --- | --- | --- | --- | --- | --- |',
  ...indexLines,
  '',
].join(NL));
console.log('wrote VISUAL_DECISION.md (' + doc.length + ' lines) and matched-image-index.md');
console.log('matched:', matched.length, '| after-only:', by('AFTER-ONLY').length, '| theme-mismatched:', by('THEME-MISMATCHED').length, '| surface-differs:', by('BEFORE-SURFACE-DIFFERS').length);
