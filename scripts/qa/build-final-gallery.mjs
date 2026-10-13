// Only confirmed observed-theme agreement may form a matched pair.
// Directory/manifest capture modes identify candidate slots, never actual theme.
import fs from 'node:fs';
import path from 'node:path';
import { EV, CD, normalPath, pairThemeStatus } from './theme-evidence.mjs';

const J = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const beforeRoutes = J(EV + '/before/index.json');
const beforeGames = J(EV + '/before-captures/index.json');
const matrix = J(EV + '/final-matrix-de6c5fcd/captures.json');
const tutorials = J(EV + '/terminal-tutorials-c8c3d46c/manifest.json');
const themes = new Map(J(EV + '/image-themes.json').images.map((image) => [normalPath(image.file), image]));
const facts = (file) => {
  const image = themes.get(normalPath(file));
  if (!image) throw new Error('theme inventory entry missing: ' + file);
  return { theme: image.theme, requestedTheme: image.requestedTheme,
    themeReason: image.themeReason, sha256: image.sha256, integrityStatus: image.integrityStatus };
};
const frame = (file, identity) => ({
  file: file.startsWith(EV + '/') ? file.slice(EV.length + 1) : file.replace(/^openspec\/changes\//, ''),
  ...identity, ...facts(file),
});
const normRoute = (file) => normalPath(file).replace(/\.png$/, '').replace(/^font-scale-2\//, 'fs2/');
const lists = () => ({ matched: [], unknown: [], mismatched: [] });
const addCandidate = (list, record) => {
  const status = pairThemeStatus(record.before.theme, record.after.theme);
  record.status = status;
  if (status === 'MATCHED') list.matched.push(record);
  else {
    record.reason = status === 'THEME-UNKNOWN' ? 'observed app theme is unverified on one or both frames'
      : 'confirmed observed themes differ';
    list[status === 'THEME-UNKNOWN' ? 'unknown' : 'mismatched'].push(record);
  }
};

const routes = lists();
const routeAfterOnly = [];
const routeBeforeOnly = [];
const afterRoutes = new Map();
for (const capture of matrix.surfaces) {
  const m = /^([a-z0-9]+)-(.+)-(light|dark)$/i.exec(capture.name);
  if (!m) throw new Error('invalid route slot: ' + capture.name);
  const key = m[1] + '/' + m[3] + '/' + m[2];
  afterRoutes.set(key, { surface: key, profile: m[1], captureTheme: m[3],
    after: frame(capture.png, { apk: matrix.build.apkSha256, source: matrix.build.codeSha }) });
}
const usedAfter = new Set();
for (const image of beforeRoutes.images) {
  const key = normRoute(image.file);
  const after = afterRoutes.get(key);
  const before = frame(EV + '/before/' + normalPath(image.file), { apk: beforeRoutes.apkSha256, source: beforeRoutes.sourceSha });
  if (!after) { routeBeforeOnly.push({ surface: key, before, reason: 'no corresponding after route slot' }); continue; }
  addCandidate(routes, { ...after, before });
  usedAfter.add(key);
}
for (const [key, route] of afterRoutes) {
  if (!usedAfter.has(key)) routeAfterOnly.push({ ...route, reason: 'no historical before capture for this route/profile slot' });
}

const tutorialBefore = new Map();
for (const image of beforeGames.images) {
  const base = path.basename(image.file).replace(/\.png$/, '');
  if (/-tutorial$/.test(base)) tutorialBefore.set(base.replace(/-tutorial$/, ''), image);
}
const tutorial = lists();
const tutorialAfterOnly = [];
for (const game of tutorials.games) {
  const record = { game: game.id, name: game.name, category: game.category, state: 'tutorial',
    profile: 'default', captureTheme: game.theme,
    after: frame(EV + '/terminal-tutorials-c8c3d46c/' + game.file, { apk: tutorials.apkSha256, source: 'd5787ec2857b0fd856d2e04ad346316d70951f6c' }) };
  // The historical tutorial has no recorded theme. Retain the former light
  // candidate slot for audit, without claiming any actual light-theme pairing.
  const before = game.theme === 'light' ? tutorialBefore.get(game.id) : null;
  if (!before) { tutorialAfterOnly.push({ ...record, reason: 'no separate historical tutorial in this declared capture slot; historical theme is UNKNOWN' }); continue; }
  addCandidate(tutorial, { ...record,
    before: frame(EV + '/before-captures/' + before.file, { apk: beforeGames.apkSha256, source: beforeGames.sourceSha }) });
}

const results = lists();
const resultBeforeMissing = [];
const rowDirs = fs.readdirSync(CD, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name).sort();
for (const game of rowDirs) {
  const review = fs.readFileSync(CD + '/' + game + '/review.md', 'utf8');
  const apk = /(?:APK under test)[^\n]*?([0-9a-f]{64})/i.exec(review)?.[1];
  if (!apk) throw new Error('filed game APK identity missing: ' + game);
  const kinds = beforeGames.images.flatMap((image) => {
    const base = path.basename(image.file).replace(/\.png$/, '');
    if (base === 'base-' + game + '-result' || base === game + '-result') return [{ ...image, kind: 'standalone' }];
    if (new RegExp('^workout-leg\\d+-' + game + '-result$').test(base)) return [{ ...image, kind: 'workout-leg' }];
    return [];
  });
  const record = { game, state: 'result', profile: 'default', captureTheme: 'UNKNOWN',
    after: frame(CD + '/' + game + '/result.png', { apk }) };
  const standalone = kinds.find((kind) => kind.kind === 'standalone');
  if (!standalone) {
    resultBeforeMissing.push({ ...record, beforeKinds: kinds.map((kind) => kind.kind + ':' + kind.file),
      reason: kinds.length ? 'only a workout-leg before result exists; its workout chrome is a different surface' : 'no historical standalone result frame' });
    continue;
  }
  addCandidate(results, { ...record, before: frame(EV + '/before-captures/' + standalone.file,
    { apk: beforeGames.apkSha256, source: beforeGames.sourceSha, kind: standalone.kind }) });
}
const gallery = {
  schemaVersion: 2, generatedAt: new Date().toISOString(),
  title: 'Campaign 076 before/after visual evidence (confirmed pairs and unresolved candidates)',
  themePolicy: 'Only hash-linked observed app-theme evidence can confirm a match. Requested modes and luminance do not.',
  identities: {
    before: { apk: beforeGames.apkSha256, source: beforeGames.sourceSha, note: 'historical pre-redesign baseline; unchanged' },
    afterMatrix: { apk: matrix.build.apkSha256, source: matrix.build.codeSha, note: 'historical post-redesign route matrix; not terminal APK' },
    afterTerminal: { apk: tutorials.apkSha256, source: 'd5787ec2857b0fd856d2e04ad346316d70951f6c', note: 'existing repaired-terminal tutorial stills; no new capture' },
    afterGameRows: { apks: [...new Set(results.unknown.concat(results.matched, results.mismatched, resultBeforeMissing).map((r) => r.after.apk))],
      note: 'filed per-game review identities, retained separately from repaired-terminal tutorials' },
  },
  summary: {
    routeMatched: routes.matched.length, routeThemeUnknown: routes.unknown.length, routeThemeMismatch: routes.mismatched.length,
    routeAfterOnly: routeAfterOnly.length, routeBeforeOnly: routeBeforeOnly.length,
    tutorialMatched: tutorial.matched.length, tutorialThemeUnknown: tutorial.unknown.length, tutorialThemeMismatch: tutorial.mismatched.length,
    tutorialAfterOnly: tutorialAfterOnly.length,
    gameResultMatched: results.matched.length, gameResultThemeUnknown: results.unknown.length, gameResultThemeMismatch: results.mismatched.length,
    gameResultBeforeMissing: resultBeforeMissing.length,
    totalMatchedPairs: routes.matched.length + tutorial.matched.length + results.matched.length,
  },
  pairs: { routes: routes.matched, tutorials: tutorial.matched, gameResults: results.matched },
  gaps: { routeThemeUnknown: routes.unknown, routeThemeMismatch: routes.mismatched, routeAfterOnly, routeBeforeOnly,
    tutorialThemeUnknown: tutorial.unknown, tutorialThemeMismatch: tutorial.mismatched, tutorialAfterOnly,
    gameResultThemeUnknown: results.unknown, gameResultThemeMismatch: results.mismatched, gameResultBeforeMissing: resultBeforeMissing },
};
fs.writeFileSync(EV + '/matched-gallery.json', JSON.stringify(gallery, null, 2) + '\n');
console.log(JSON.stringify(gallery.summary, null, 1));
