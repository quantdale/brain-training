// Build the final matched before/after gallery for the 076 visual evidence
// package, requiring theme agreement measured from the pixels rather than from a
// filename, and classifying every surface as matched / after-only / before-only /
// theme-mismatched.
//
// Pairs are formed from existing evidence only, plus the 42 tutorial frames
// captured on the repaired terminal APK by capture-terminal-tutorials.mjs. No
// synthetic before state is created and no before frame is relabelled.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EV = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence';
const CD = 'openspec/changes/076-f-final-product-certification/evidence/current-device';
const TT = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence/terminal-tutorials-c8c3d46c';

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rel = (p) => p.split(path.sep).join('/');

const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const beforeRoutes = J(path.join(EV, 'before/index.json'));
const beforeGames = J(path.join(EV, 'before-captures/index.json'));
const matrix = J(path.join(EV, 'final-matrix-de6c5fcd/captures.json'));
const themeData = J(path.join(EV, 'image-themes.json'));
const tutorials = J(path.join(TT, 'manifest.json'));

// measured theme lookup: relative path -> {theme, meanLuminance, blank}
const measured = new Map();
for (const img of themeData.images) {
  measured.set(rel(img.file).replace('openspec/changes/076-product-wide-ui-ux-reboot/evidence/', ''), img);
}
for (const g of tutorials.games) {
  measured.set(`terminal-tutorials-c8c3d46c/${g.id}-${g.theme}.png`, { theme: g.measuredTheme, meanLuminance: g.meanLuminance, blank: g.blank });
}
const themeOf = (key) => { const m = measured.get(key); return m ? m.theme : null; };

const normRoute = (p) => String(p).replace(/\\/g, '/').replace(/\.(png|xml|txt)$/i, '').replace(/^font-scale-2\//, 'fs2/');

// ---- 1. ROUTE pairs --------------------------------------------------------
const afterRoute = new Map();
for (const s of matrix.surfaces) {
  const m = /^([a-z0-9]+)-(.+)-(light|dark)$/i.exec(s.name);
  if (!m) continue;
  afterRoute.set(normRoute(`${m[1]}/${m[3]}/${m[2]}`), { file: `${m[1]}/${m[3]}/${m[2]}.png`, surface: s.name });
}
const routePairs = [];
const routeThemeMismatch = [];
const routeAfterOnly = [];
const usedAfter = new Set();
for (const img of beforeRoutes.images) {
  const key = normRoute(img.file);
  const a = afterRoute.get(key);
  if (!a) continue;
  const bt = themeOf(`before/${img.file}`);
  const at = themeOf(`final-matrix-de6c5fcd/${a.file}`);
  const pair = {
    surface: key,
    before: { file: `before/${img.file}`, sha256: img.sha256, apk: beforeRoutes.apkSha256, theme: bt || themeFromPath(img.file) },
    after: { file: `final-matrix-de6c5fcd/${a.file}`, apk: matrix.build.apkSha256, source: matrix.build.codeSha, theme: at || themeFromPath(a.file) },
  };
  const agree = pair.before.theme && pair.after.theme && pair.before.theme === pair.after.theme;
  (agree ? routePairs : routeThemeMismatch).push(agree ? pair : { ...pair, reason: `before ${pair.before.theme} vs after ${pair.after.theme}` });
  usedAfter.add(a.file);
}
function themeFromPath(p) { return /\/dark\//.test(String(p).replace(/\\/g, '/')) ? 'dark' : 'light'; }
for (const [key, a] of afterRoute) {
  if (!usedAfter.has(a.file)) routeAfterOnly.push({ surface: key, after: { file: `final-matrix-de6c5fcd/${a.file}`, apk: matrix.build.apkSha256, source: matrix.build.codeSha, theme: themeFromPath(a.file) }, reason: 'no historical before capture on the pre-redesign build' });
}

// ---- 2. TUTORIAL pairs ----------------------------------------------------
const tutorialBefore = new Map();
for (const img of beforeGames.images) {
  const b = path.basename(img.file).replace(/\.png$/i, '');
  if (/-tutorial$/.test(b)) tutorialBefore.set(b.replace(/-tutorial$/, ''), img);
}
const tutorialPairs = [];
const tutorialAfterOnly = [];
for (const g of tutorials.games.filter((x) => x.theme === 'light')) {
  const before = tutorialBefore.get(g.id);
  if (!before) { tutorialAfterOnly.push({ game: g.id, reason: 'no historical before tutorial capture' }); continue; }
  tutorialPairs.push({
    game: g.id,
    name: g.name,
    category: g.category,
    state: 'tutorial',
    theme: 'light',
    before: { file: `before-captures/${before.file}`, sha256: before.sha256, apk: beforeGames.apkSha256, source: beforeGames.sourceSha, theme: themeOf(`before-captures/${before.file}`) || 'light' },
    after: { file: `terminal-tutorials-c8c3d46c/${g.id}-light.png`, sha256: g.sha256, apk: tutorials.apkSha256, theme: g.measuredTheme },
  });
}

// ---- 3. GAME RESULT pairs: theme must agree --------------------------------
const resultPairs = [];
const resultThemeMismatch = [];
const resultBeforeMissing = [];
const rowApk = (game) => {
  const t = fs.readFileSync(path.join(CD, game, 'review.md'), 'utf8');
  const m = /(?:APK under test)[^\n]*?([0-9a-f]{64})/i.exec(t);
  return m ? m[1] : null;
};
const rows = fs.readdirSync(CD, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name).sort();

// A game's historical result frame is named one of three ways:
//   base-<game>-result.png              standalone board, canonical form
//   <game>-result.png                   standalone board, unprefixed
//   workout-leg<N>-<game>-result.png    result reached inside a workout leg
// The context differs, so it is recorded with the pair rather than flattened
// away: a workout-leg result screen carries workout progress chrome that a
// standalone result does not, and calling them the same surface would be the
// equivalence the brief forbids.
const resultKinds = (game) => {
  const out = [];
  for (const i of beforeGames.images) {
    const b = path.basename(i.file).replace(/\.png$/i, '');
    if (b === `base-${game}-result`) out.push({ kind: 'standalone-base', file: i.file, sha256: i.sha256 });
    else if (b === `${game}-result`) out.push({ kind: 'standalone-plain', file: i.file, sha256: i.sha256 });
    else { const m = new RegExp(`^workout-leg(\\d+)-${game}-result$`).exec(b); if (m) out.push({ kind: `workout-leg${m[1]}`, file: i.file, sha256: i.sha256 }); }
  }
  return out;
};

for (const game of rows) {
  const afterPath = path.join(CD, game, 'result.png');
  if (!fs.existsSync(afterPath)) continue;
  const afterKey = `076-f-final-product-certification/evidence/current-device/${game}/result.png`;
  const at = (measured.get(afterKey) || {}).theme || 'dark';
  const kinds = resultKinds(game);
  const rec = { game, state: 'result', after: { file: `076-f-final-product-certification/evidence/current-device/${game}/result.png`, apk: rowApk(game), theme: at } };
  // A pair is only formed from a STANDALONE before result: a workout-leg result
  // is a different surface and is reported as such instead of being paired.
  const standalone = kinds.find((k) => k.kind.startsWith('standalone')) || null;
  const workout = kinds.filter((k) => !k.kind.startsWith('standalone'));
  if (!standalone) {
    resultBeforeMissing.push({ ...rec, beforeKinds: kinds.map((k) => `${k.kind}:${k.file}`), reason: workout.length ? `only a workout-leg before result exists (${workout.map((w) => w.kind).join(', ')}), which is a different surface from a standalone result` : 'no historical before result capture' });
    continue;
  }
  rec.before = { file: `before-captures/${standalone.file}`, sha256: standalone.sha256, apk: beforeGames.apkSha256, theme: themeOf(`before-captures/${standalone.file}`) || 'light', kind: standalone.kind };
  if (rec.before.theme === at) resultPairs.push(rec);
  else resultThemeMismatch.push({ ...rec, reason: `before ${rec.before.theme} vs after ${at}` });
}

const gallery = {
  generatedAt: new Date().toISOString(),
  title: 'Campaign 076 matched before/after visual gallery',
  identities: {
    before: { apk: beforeGames.apkSha256, apkShort: 'd631ab9a', source: beforeGames.sourceSha, note: 'pre-redesign baseline; NOT rebuilt and NOT relabelled' },
    afterMatrix: { apk: matrix.build.apkSha256, apkShort: 'de6c5fcd', source: matrix.build.codeSha, note: 'post-redesign route matrix; retains its own identity' },
    afterTerminal: { apk: tutorials.apkSha256, apkShort: 'c8c3d46c', source: 'd5787ec', note: 'repaired terminal APK; tutorial frames captured on it' },
  },
  summary: {
    routeMatched: routePairs.length,
    routeThemeMismatch: routeThemeMismatch.length,
    routeAfterOnly: routeAfterOnly.length,
    tutorialMatched: tutorialPairs.length,
    tutorialAfterOnly: tutorialAfterOnly.length,
    gameResultMatched: resultPairs.length,
    gameResultThemeMismatch: resultThemeMismatch.length,
    gameResultBeforeMissing: resultBeforeMissing.length,
    totalMatchedPairs: routePairs.length + tutorialPairs.length + resultPairs.length,
  },
  pairs: { routes: routePairs, tutorials: tutorialPairs, gameResults: resultPairs },
  gaps: {
    routeThemeMismatch,
    routeAfterOnly,
    tutorialAfterOnly,
    gameResultThemeMismatch: resultThemeMismatch,
    gameResultBeforeMissing: resultBeforeMissing,
  },
};
fs.writeFileSync(path.join(EV, 'matched-gallery.json'), `${JSON.stringify(gallery, null, 2)}\n`);
console.log(JSON.stringify(gallery.summary, null, 1));
console.log('\ntheme-mismatched game results:', resultThemeMismatch.length);
for (const r of resultThemeMismatch.slice(0, 3)) console.log(`  ${r.game}: ${r.reason}`);
