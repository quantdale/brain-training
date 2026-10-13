// One row per filed surface slot; uncertain themes never count as matched.
import fs from 'node:fs';
import { EV } from './theme-evidence.mjs';
const gallery = JSON.parse(fs.readFileSync(EV + '/matched-gallery.json', 'utf8'));
const rows = [];
const add = (kind, records, status) => {
  for (const record of records) {
    rows.push({ kind, profile: record.profile || 'default', captureTheme: record.captureTheme || 'UNKNOWN',
      theme: record.after?.theme || record.before?.theme || 'UNKNOWN',
      surface: kind === 'route' ? record.surface.split('/').slice(2).join('/') : record.game + '/' + record.state,
      status, before: record.before || null, after: record.after || null,
      ...(record.beforeKinds ? { beforeKinds: record.beforeKinds } : {}),
      note: record.reason || 'same surface/profile with confirmed observed-theme agreement' });
  }
};
add('route', gallery.pairs.routes, 'MATCHED');
add('route', gallery.gaps.routeThemeUnknown, 'THEME-UNKNOWN');
add('route', gallery.gaps.routeThemeMismatch, 'THEME-MISMATCHED');
add('route', gallery.gaps.routeAfterOnly, 'AFTER-ONLY');
add('route', gallery.gaps.routeBeforeOnly, 'BEFORE-ONLY');
add('game', gallery.pairs.tutorials, 'MATCHED');
add('game', gallery.gaps.tutorialThemeUnknown, 'THEME-UNKNOWN');
add('game', gallery.gaps.tutorialThemeMismatch, 'THEME-MISMATCHED');
add('game', gallery.gaps.tutorialAfterOnly, 'AFTER-ONLY');
add('game', gallery.pairs.gameResults, 'MATCHED');
add('game', gallery.gaps.gameResultThemeUnknown, 'THEME-UNKNOWN');
add('game', gallery.gaps.gameResultThemeMismatch, 'THEME-MISMATCHED');
add('game', gallery.gaps.gameResultBeforeMissing, 'BEFORE-SURFACE-DIFFERS');
rows.sort((a, b) => [a.kind, a.profile, a.captureTheme, a.surface].join('|').localeCompare([b.kind, b.profile, b.captureTheme, b.surface].join('|')));
const byStatus = {};
for (const row of rows) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
const matrix = { schemaVersion: 2, generatedAt: new Date().toISOString(),
  title: 'Campaign 076 visual evidence coverage matrix', identities: gallery.identities,
  slotPolicy: 'captureTheme identifies a declared/requested slot, not observed app theme; theme is the observed classification',
  totals: { rows: rows.length, byStatus },
  statusMeaning: {
    MATCHED: 'same surface/profile, both frames have the same hash-linked observed app theme',
    'THEME-UNKNOWN': 'candidate frames exist but observed theme is unverified; never a matched comparison',
    'THEME-MISMATCHED': 'confirmed observed themes differ; never a matched comparison',
    'AFTER-ONLY': 'no separate historical frame for this declared slot; historical themes are not inferred',
    'BEFORE-ONLY': 'no corresponding after frame for this slot',
    'BEFORE-SURFACE-DIFFERS': 'historical frame is a different surface, such as a workout-leg result',
  }, rows };
fs.writeFileSync(EV + '/coverage-matrix.json', JSON.stringify(matrix, null, 2) + '\n');
console.log(JSON.stringify(matrix.totals, null, 1));
