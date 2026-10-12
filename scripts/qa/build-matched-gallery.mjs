// Compute the matched before/after pairs for the 076 visual evidence package.
//
// ROUTES:  before/ (20 captures on d631ab9a)  <->  final-matrix-de6c5fcd (90 on de6c5fcd)
// GAMES:   before-captures/ (272 states on d631ab9a)  <->  076-f current-device/ (42 rows on the
//          artifact named by each row's review.md)
//
// A pair MATCHES only when the surface key (route, or game+state) and the profile/theme
// are the same. Pairs with no counterpart are reported as after-only or before-only;
// nothing is inferred, and no synthetic before state is created.
import fs from 'node:fs';
import path from 'node:path';

const EV = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence';
const CD = 'openspec/changes/076-f-final-product-certification/evidence/current-device';

const beforeRoutes = JSON.parse(fs.readFileSync(path.join(EV, 'before/index.json'), 'utf8'));
const matrix = JSON.parse(fs.readFileSync(path.join(EV, 'final-matrix-de6c5fcd/captures.json'), 'utf8'));
const beforeGames = JSON.parse(fs.readFileSync(path.join(EV, 'before-captures/index.json'), 'utf8'));

// --- normalise a route path into a comparable key -----------------------------
const normRoute = (p) => {
  let s = String(p).replace(/\\/g, '/').replace(/\.(png|xml|txt)$/i, '');
  // font-scale-2 (historical) and fs2 (matrix) are the same profile.
  s = s.replace(/^font-scale-2\//, 'fs2/');
  s = s.replace(/^default\//, 'default/');
  return s;
};

const afterRouteKey = new Map(); // key -> file
for (const s of matrix.surfaces) {
  const m = /^([a-z0-9]+)-(.+)-(light|dark)$/i.exec(s.name);
  if (!m) continue;
  const key = normRoute(`${m[1]}/${m[3]}/${m[2]}`);
  afterRouteKey.set(key, `${m[1]}/${m[3]}/${m[2]}.png`);
}

const routePairs = [];
const routeAfterOnly = [];
const seenAfter = new Set();
for (const img of beforeRoutes.images) {
  const key = normRoute(img.file);
  const after = afterRouteKey.get(key);
  if (after) {
    routePairs.push({ surface: key, before: img.file, beforeSha: img.sha256, after, afterApk: matrix.build.apkSha256, beforeApk: beforeRoutes.apkSha256 });
    seenAfter.add(after);
  }
}
for (const [key, file] of afterRouteKey) {
  if (!seenAfter.has(file)) routeAfterOnly.push({ surface: key, after: file, afterApk: matrix.build.apkSha256 });
}
const routeBeforeOnly = beforeRoutes.images.filter((i) => !afterRouteKey.has(normRoute(i.file)));

// --- games -------------------------------------------------------------------
// Before game states are named `<prefix>-<game>-<state>` where prefix is `base` for
// board states and absent for tutorial captures.
const GAME_STATES = ['tutorial', 'tutorial-solved', 'tutorial-stuck', 'active', 'pause', 'result', 'feedback'];
const beforeGameStates = new Map(); // game -> state -> file
for (const img of beforeGames.images) {
  const b = path.basename(img.file).replace(/\.png$/i, '');
  for (const st of GAME_STATES) {
    if (b.endsWith('-' + st)) {
      const game = b.replace(/-(base)?-?[^-]*$/, '').replace(new RegExp('-' + st + '$'), '');
      const g = b.slice(0, b.length - st.length).replace(/-$/, '').replace(/^base-/, '');
      if (!g) continue;
      if (!beforeGameStates.has(g)) beforeGameStates.set(g, {});
      beforeGameStates.get(g)[st] = img.file;
    }
  }
}

const gameRows = fs.readdirSync(CD, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name)
  .sort();

const gamePairs = [];
const gameAfterOnly = [];
const gameBeforeOnly = [];
for (const game of gameRows) {
  const dir = path.join(CD, game);
  const result = path.join(dir, 'result.png');
  const hasResult = fs.existsSync(result);
  const rowText = fs.existsSync(path.join(dir, 'review.md')) ? fs.readFileSync(path.join(dir, 'review.md'), 'utf8') : '';
  const apkMatch = /(?:APK under test|apk under test)[^\n]*?([0-9a-f]{64})/i.exec(rowText);
  const rowApk = apkMatch ? apkMatch[1] : null;
  const states = beforeGameStates.get(game);
  if (states && states.result) {
    gamePairs.push({
      game,
      state: 'result',
      before: states.result,
      beforeApk: beforeGames.apkSha256,
      after: `current-device/${game}/result.png`,
      afterApk: rowApk,
      beforeStates: Object.keys(states),
    });
  } else if (hasResult) {
    gameAfterOnly.push({ game, after: `current-device/${game}/result.png`, afterApk: rowApk, beforeStates: states ? Object.keys(states) : [] });
  }
  for (const st of Object.keys(states || {})) {
    if (st !== 'result') gameBeforeOnly.push({ game, state: st, before: states[st] });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  identities: {
    beforeRoutes: { apk: beforeRoutes.apkSha256, source: beforeRoutes.sourceSha, count: beforeRoutes.images.length },
    beforeGames: { apk: beforeGames.apkSha256, source: beforeGames.sourceSha, count: beforeGames.images.length },
    afterMatrix: { apk: matrix.build.apkSha256, source: matrix.build.codeSha, count: matrix.surfaces.length, profiles: matrix.profiles, themes: matrix.themes },
  },
  routes: {
    matchedPairs: routePairs.length,
    afterOnly: routeAfterOnly.length,
    beforeOnly: routeBeforeOnly.length,
    pairs: routePairs,
    afterOnlyList: routeAfterOnly,
    beforeOnlyList: routeBeforeOnly,
  },
  games: {
    matchedPairs: gamePairs.length,
    afterOnly: gameAfterOnly.length,
    beforeOnlyStates: gameBeforeOnly.length,
    pairs: gamePairs,
    afterOnlyList: gameAfterOnly,
    beforeOnlyList: gameBeforeOnly,
  },
};

fs.writeFileSync('openspec/changes/076-product-wide-ui-ux-reboot/evidence/matched-gallery.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  routes: { matched: routePairs.length, afterOnly: routeAfterOnly.length, beforeOnly: routeBeforeOnly.length },
  games: { matched: gamePairs.length, afterOnly: gameAfterOnly.length, beforeOnlyStates: gameBeforeOnly.length },
}, null, 2));
console.log('\nmatched route surfaces:');
for (const p of routePairs) console.log(`  ${p.surface}  ${p.before}  ->  ${p.after}`);
console.log('\nafter-only route surfaces:');
for (const a of routeAfterOnly) console.log(`  ${a.surface}`);
console.log('\nbefore-only route surfaces:');
for (const b of routeBeforeOnly) console.log(`  ${b.before}`);
console.log('\ngame result pairs:', gamePairs.length, '| games with no matching before result:', gameAfterOnly.length);
