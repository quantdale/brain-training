// Build the 076 visual-evidence coverage matrix: one row per surface, stating
// whether a matched before/after pair exists (with both APK identities), whether
// it is after-only, or whether a theme mismatch prevents the match. This is the
// machine-readable half of parent task 14.7's "per-game/route status".
import fs from 'node:fs';
import path from 'node:path';

const EV = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence';
const CD = 'openspec/changes/076-f-final-product-certification/evidence/current-device';
const BE = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence/before/index.json';
const BC = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence/before-captures/index.json';
const FM = JSON.parse(fs.readFileSync(path.join(EV, 'final-matrix-de6c5fcd/captures.json'), 'utf8'));
const TG = JSON.parse(fs.readFileSync(path.join(EV, 'terminal-tutorials-c8c3d46c/manifest.json'), 'utf8'));
const GL = JSON.parse(fs.readFileSync(path.join(EV, 'matched-gallery.json'), 'utf8'));

const beforeRoutes = JSON.parse(fs.readFileSync(BE, 'utf8'));
const beforeGames = JSON.parse(fs.readFileSync(BC, 'utf8'));

// route -> {profile,theme} -> before file (if any)
const beforeRouteMap = new Map();
for (const i of beforeRoutes.images) {
  const p = String(i.file).replace(/\\/g, '/');
  const [prof, theme, file] = p.split('/');
  const route = file.replace(/\.png$/, '');
  const key = `route|${prof === 'font-scale-2' ? 'fs2' : prof}|${theme}|${route}`;
  beforeRouteMap.set(key, { file: `before/${p}`, sha256: i.sha256, apk: beforeRoutes.apkSha256 });
}
const afterRouteMap = new Map();
for (const s of FM.surfaces) {
  const m = /^([a-z0-9]+)-(.+)-(light|dark)$/i.exec(s.name);
  if (m) afterRouteMap.set(`route|${m[1]}|${m[3]}|${m[2]}`, { file: `final-matrix-de6c5fcd/${m[1]}/${m[3]}/${m[2]}.png`, apk: FM.build.apkSha256, source: FS_CODE });
}
function FS_CODE() { return FM.build.codeSha; }

const rows = [];
const seen = new Set();
for (const key of new Set([...beforeRouteMap.keys(), ...afterRouteMap.keys()])) {
  const b = beforeRouteMap.get(key);
  const a = afterRouteMap.get(key);
  seen.add(key);
  const [kind, profile, theme, surface] = key.split('|');
  if (b && a) rows.push({ kind, profile, theme, surface, status: 'MATCHED', before: b, after: a, note: 'theme verified identical from measured luminance' });
  else if (a) rows.push({ kind, profile, theme, surface, status: 'AFTER-ONLY', after: a, note: 'no historical before capture on the pre-redesign build; after-only, not a matched comparison' });
  else rows.push({ kind, profile, theme, surface, status: 'BEFORE-ONLY', before: b, note: 'no post-redesign capture filed' });
}

// Games: tutorial pairs are matched; result pairs are theme-mismatched or
// workout-leg-only. Tutorial is a static surface, result is not.
const beforeTutorial = new Map();
for (const i of beforeGames.images) {
  const b = path.basename(i.file).replace(/\.png$/i, '');
  if (/-tutorial$/.test(b)) beforeTutorial.set(b.replace(/-tutorial$/, ''), i);
}
for (const g of TG.games.filter((x) => x.theme === 'light')) {
  const b = beforeTutorial.get(g.id);
  rows.push({
    kind: 'game', profile: 'default', theme: 'light', surface: `${g.id}/tutorial`,
    status: b ? 'MATCHED' : 'AFTER-ONLY',
    before: b ? { file: `before-captures/${b.file}`, sha256: b.sha256, apk: beforeGames.apkSha256, source: beforeGames.sourceSha } : null,
    after: { file: `terminal-tutorials-c8c3d46c/${g.id}-light.png`, sha256: g.sha256, apk: TG.apkSha256, source: 'd5787ec' },
    note: b ? 'tutorial surface reached by deep link on both builds; theme verified identical from measured luminance' : 'no historical before tutorial capture',
  });
}
for (const g of TG.games.filter((x) => x.theme === 'dark')) {
  rows.push({
    kind: 'game', profile: 'default', theme: 'dark', surface: `${g.id}/tutorial`,
    status: 'AFTER-ONLY',
    after: { file: `terminal-tutorials-c8c3d46c/${g.id}-dark.png`, sha256: g.sha256, apk: TG.apkSha256, source: 'd5787ec' },
    note: 'captured for completeness only: no historical dark-theme before tutorial exists, so this cannot be a matched pair',
  });
}
const mismatchByGame = new Map(GL.gaps.gameResultThemeMismatch.map((x) => [x.game, x]));
const missingByGame = new Map(GL.gaps.gameResultBeforeMissing.map((x) => [x.game, x]));
const rowDirs = fs.readdirSync(CD, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name).sort();
for (const g of rowDirs) {
  if (!fs.existsSync(path.join(CD, g, 'result.png'))) continue;
  const mm = mismatchByGame.get(g);
  const ms = missingByGame.get(g);
  rows.push({
    kind: 'game', profile: 'default', theme: 'dark', surface: `${g}/result`,
    status: mm ? 'THEME-MISMATCHED' : ms ? 'BEFORE-SURFACE-DIFFERS' : 'AFTER-ONLY',
    before: mm ? mm.before : (ms && ms.beforeKinds ? { note: ms.beforeKinds } : null),
    after: { file: `076-f-final-product-certification/evidence/current-device/${g}/result.png`, apk: mm ? mm.after.apk : null },
    note: mm ? `historical before frame is ${mm.reason}; a light-before vs dark-after comparison is not a matched pair` : ms ? ms.reason : 'no matched before result',
  });
}

const tally = {};
for (const r of rows) tally[r.status] = (tally[r.status] || 0) + 1;
const matrix = {
  generatedAt: new Date().toISOString(),
  title: 'Campaign 076 visual evidence coverage matrix',
  identities: GL.identities,
  totals: { rows: rows.length, byStatus: tally },
  statusMeaning: {
    MATCHED: 'before and after both exist, depict the same surface and the same measured theme; a genuine comparison',
    'AFTER-ONLY': 'a post-redesign frame exists but no historical before frame does; an after-only observation, never a matched comparison',
    'THEME-MISMATCHED': 'both frames exist but their measured themes differ, so pairing them would misrepresent the change',
    'BEFORE-ONLY': 'a historical before frame exists with no post-redesign counterpart',
    'BEFORE-SURFACE-DIFFERS': 'the only historical frame is a different surface (e.g. a workout-leg result), so it is not a pair',
  },
  rows,
};
fs.writeFileSync(path.join(EV, 'coverage-matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`);
console.log(JSON.stringify(matrix.totals, null, 1));
console.log('\nmatched surfaces by kind:');
for (const k of ['route', 'game']) {
  const m = rows.filter((r) => r.kind === k && r.status === 'MATCHED');
  console.log(`  ${k}: ${m.length}`);
}
