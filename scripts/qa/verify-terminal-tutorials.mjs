// Recheck existing tutorial bytes/surfaces without recapture or overwriting a
// recorded hash. The capture theme was requested, not an observed preference.
import fs from 'node:fs';
import { analyseImage } from './image-theme.mjs';
import { EV, checkIndexedImage, loadThemeInventory, resolveTheme } from './theme-evidence.mjs';

const dir = EV + '/terminal-tutorials-c8c3d46c';
const manifest = JSON.parse(fs.readFileSync(dir + '/manifest.json', 'utf8'));
const entries = loadThemeInventory().filter((e) => e.inventory === 'terminal-tutorials-c8c3d46c');
const issues = [];
const updates = [];
for (const entry of entries) {
  const sha256 = checkIndexedImage(entry); // Fail before publishing a changed manifest.
  const image = analyseImage(entry.file);
  const game = manifest.games.find((g) => entry.file === dir + '/' + g.file);
  const xml = fs.readFileSync(entry.file.replace(/\.png$/, '.xml'), 'utf8');
  if (!xml.includes('resource-id="' + game.id + '.intro-back"') || !xml.includes('resource-id="' + game.id + '.start"')) issues.push(game.file + ': tutorial surface not proven');
  if (image.blank) issues.push(game.file + ': uniform frame');
  if (image.width !== 1080 || image.height !== 2400) issues.push(game.file + ': unexpected dimensions');
  updates.push({ game, image, theme: resolveTheme(sha256, entry.metadata) });
}
if (entries.length !== 84 || new Set(entries.map((e) => e.file)).size !== 84) issues.push('expected 84 unique tutorial frames');
if (issues.length) throw new Error(issues.join('\n'));
for (const { game, image, theme } of updates) {
  // Preserve original request, hash and byte count; withdraw luminance-derived proof.
  delete game.measuredTheme;
  delete game.themeMatchesRequest;
  game.meanLuminance = image.meanLuminance;
  game.dominantShare = image.dominantShare;
  game.blank = image.blank;
  game.observedTheme = theme.theme;
  game.themeReason = theme.themeReason;
  game.themeMetadata = theme.themeMetadata;
}
manifest.verification = { analysedAt: new Date().toISOString(), frames: entries.length,
  pngHashesVerified: entries.length, introSurfacesVerified: entries.length,
  blankFrames: [], unexpectedDimensions: [],
  observedThemeCounts: updates.reduce((counts, u) => ({ ...counts, [u.theme.theme]: (counts[u.theme.theme] || 0) + 1 }), {}),
  themeVerification: 'NOT VALIDATED: recorded theme is a capture request; no observed app-theme witness',
};
fs.writeFileSync(dir + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.verification, null, 1));
