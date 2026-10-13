// PNG brightness is diagnostic only; it cannot establish the selected app theme.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const { PNG } = createRequire(new URL('../../apps/mobile/package.json', import.meta.url))('pngjs');

const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

export function analyseImage(file) {
  const buf = fs.readFileSync(file);
  const decoded = PNG.sync.read(buf);
  const img = { w: decoded.width, h: decoded.height, ch: 4, data: decoded.data };
  const n = img.w * img.h;
  let sum = 0;
  let min = 1;
  let max = 0;
  const colours = new Map();
  const step = Math.max(1, Math.floor(n / 60000));
  let counted = 0;
  for (let i = 0; i < n; i += step) {
    const o = i * img.ch;
    const r = img.data[o];
    const g = img.data[o + 1];
    const b = img.data[o + 2];
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    sum += L;
    if (L < min) min = L;
    if (L > max) max = L;
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    colours.set(k, (colours.get(k) || 0) + 1);
    counted += 1;
  }
  const mean = sum / counted;
  // dominant share of the single most common coarse colour
  let top = 0;
  for (const v of colours.values()) if (v > top) top = v;
  return {
    file,
    width: img.w,
    height: img.h,
    bytes: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    meanLuminance: Number(mean.toFixed(4)),
    theme: 'UNKNOWN',
    themeReason: 'PNG brightness alone does not establish the selected app theme',
    dominantShare: Number((top / counted).toFixed(4)),
    dynamicRange: Number((max - min).toFixed(4)),
    uniform: top / counted > 0.97,
    blank: top / counted > 0.985,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv.slice(2).map((file) => {
    try { return analyseImage(file); } catch (error) { return { file, error: error.message }; }
  });
  console.log(JSON.stringify(out, null, 1));
}
