// Brightness is diagnostic only. Resolve theme from hash-linked metadata,
// separating requested capture mode from observed app theme; uncertainty stays UNKNOWN.
import fs from 'node:fs';
import { analyseImage } from './image-theme.mjs';
import { EV, loadThemeInventory, checkIndexedImage, resolveTheme } from './theme-evidence.mjs';

const images = loadThemeInventory().map((entry) => {
  const sha256 = checkIndexedImage(entry);
  return { ...analyseImage(entry.file), inventory: entry.inventory,
    integritySource: entry.integritySource,
    integrityStatus: entry.integritySource ? 'INDEX_HASH_VERIFIED' : 'HASH_COMPUTED_ONLY',
    ...resolveTheme(sha256, entry.metadata) };
});
const summary = {};
for (const image of images) {
  const key = image.inventory + '|' + image.theme;
  summary[key] = (summary[key] || 0) + 1;
}
fs.writeFileSync(EV + '/image-themes.json', JSON.stringify({ schemaVersion: 2,
  generatedAt: new Date().toISOString(), count: images.length,
  method: 'hash-linked observed app-theme metadata only; requested modes separate; luminance diagnostic only',
  images }, null, 2) + '\n');
console.log('images analysed:', images.length);
for (const [key, count] of Object.entries(summary).sort()) console.log('  ' + key + ': ' + count);
