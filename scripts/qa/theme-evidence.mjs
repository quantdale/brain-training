// A system night-mode request does not prove the theme of an app with a persisted
// preference. Keep requested modes separate; absent observed evidence is UNKNOWN.
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const EV = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence';
export const CD = 'openspec/changes/076-f-final-product-certification/evidence/current-device';
export const knownTheme = (theme) => theme === 'light' || theme === 'dark';
export const normalPath = (file) => file.replace(/\\/g, '/');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function resolveTheme(sha256, metadata = []) {
  const linked = metadata.filter((m) => m.sha256 === sha256 && knownTheme(m.theme));
  const observed = new Set(linked.filter((m) => m.kind === 'observed-app-theme').map((m) => m.theme));
  const requested = new Set(linked.filter((m) => m.kind === 'requested-capture-mode').map((m) => m.theme));
  const unlinked = metadata.some((m) => m.sha256 !== sha256);
  return {
    theme: !unlinked && observed.size === 1 ? [...observed][0] : 'UNKNOWN',
    requestedTheme: requested.size === 1 ? [...requested][0] : 'UNKNOWN',
    themeReason: unlinked ? 'theme metadata is not linked to these PNG bytes'
      : observed.size > 1 ? 'observed theme metadata conflicts'
        : observed.size === 1 ? 'hash-linked observed app-theme metadata'
          : 'no hash-linked observed app-theme metadata; capture requests and brightness are insufficient',
    themeMetadata: metadata.map((m) => ({ ...m, hashMatches: m.sha256 === sha256 })),
  };
}

export function pairThemeStatus(before, after) {
  if (!knownTheme(before) || !knownTheme(after)) return 'THEME-UNKNOWN';
  return before === after ? 'MATCHED' : 'THEME-MISMATCHED';
}

/** Exact inventories, excluding unrelated/superseded certification PNGs. */
export function loadThemeInventory() {
  const entries = [];
  for (const dir of ['before-captures', 'before']) {
    const source = `${EV}/${dir}/index.json`;
    for (const [i, image] of json(source).images.entries()) {
      entries.push({ file: normalPath(`${EV}/${dir}/${image.file}`), inventory: dir,
        indexedSha256: image.sha256, indexedBytes: image.bytes, metadata: [],
        integritySource: `${source}#images[${i}]` });
    }
  }
  const matrixSource = `${EV}/final-matrix-de6c5fcd/captures.json`;
  for (const [i, capture] of json(matrixSource).surfaces.entries()) {
    const m = /^([a-z0-9]+)-(.+)-(light|dark)$/i.exec(capture.name);
    if (!m) throw new Error(`invalid matrix surface ${capture.name}`);
    const file = `${EV}/final-matrix-de6c5fcd/${m[1]}/${m[3]}/${m[2]}.png`;
    if (normalPath(capture.png) !== file) throw new Error(`matrix path disagrees: ${capture.name}`);
    entries.push({ file, inventory: 'final-matrix-de6c5fcd',
      indexedSha256: capture.pngSha256, indexedBytes: capture.pngBytes,
      integritySource: `${matrixSource}#surfaces[${i}]`,
      metadata: [{ source: matrixSource, field: `surfaces[${i}].theme`, theme: capture.theme,
        sha256: capture.pngSha256, kind: 'requested-capture-mode' }] });
  }
  const tutorialSource = `${EV}/terminal-tutorials-c8c3d46c/manifest.json`;
  for (const [i, game] of json(tutorialSource).games.entries()) {
    if (!game.captured || !game.file) throw new Error(`missing tutorial capture ${game.id}/${game.theme}`);
    entries.push({ file: `${EV}/terminal-tutorials-c8c3d46c/${game.file}`, inventory: 'terminal-tutorials-c8c3d46c',
      indexedSha256: game.sha256, indexedBytes: game.bytes,
      integritySource: `${tutorialSource}#games[${i}]`,
      metadata: [{ source: tutorialSource, field: `games[${i}].theme`, theme: game.theme,
        sha256: game.sha256, kind: 'requested-capture-mode' }] });
  }
  const dirs = fs.readdirSync(CD, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_'));
  for (const dir of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = `${CD}/${dir.name}/result.png`;
    if (!fs.existsSync(file)) throw new Error(`missing filed game result: ${file}`);
    entries.push({ file, inventory: 'current-device (filed result rows)',
      indexedSha256: null, indexedBytes: null, integritySource: null, metadata: [] });
  }
  return entries;
}

export function checkIndexedImage(entry) {
  const bytes = fs.readFileSync(entry.file);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (entry.integritySource && (!/^[a-f0-9]{64}$/.test(entry.indexedSha256 ?? '') || sha256 !== entry.indexedSha256 || bytes.length !== entry.indexedBytes)) {
    throw new Error(`indexed PNG hash/bytes mismatch: ${entry.file}`);
  }
  return sha256;
}
