// Analyse the 42 captured tutorial frames: measured theme must match the requested
// theme, and no frame may be blank/uniform (a capture that does not depict its
// surface is exactly what the evidence rules reject).
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import path from 'node:path';

const DIR = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence/terminal-tutorials-c8c3d46c';

function decode(buf) {
  let off = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const t = buf.toString('ascii', off + 4, off + 8);
    const d = buf.subarray(off + 8, off + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : 3;
  const st = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(st);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + st));
    pos += st;
    for (let i = 0; i < st; i++) {
      const a = i >= ch ? line[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    line.copy(out, y * st);
    prev = line;
  }
  return { w, h, ch, data: out };
}
const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
function analyse(file) {
  const buf = fs.readFileSync(file);
  const img = decode(buf);
  const n = img.w * img.h;
  let sum = 0;
  const colours = new Map();
  const step = Math.max(1, Math.floor(n / 60000));
  let counted = 0;
  for (let i = 0; i < n; i += step) {
    const o = i * img.ch;
    const r = img.data[o];
    const g = img.data[o + 1];
    const b = img.data[o + 2];
    sum += 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    colours.set(k, (colours.get(k) || 0) + 1);
    counted += 1;
  }
  let top = 0;
  for (const v of colours.values()) if (v > top) top = v;
  const mean = sum / counted;
  return {
    file: path.basename(file),
    bytes: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    width: img.w,
    height: img.h,
    meanLuminance: Number(mean.toFixed(4)),
    theme: mean >= 0.35 ? 'light' : 'dark',
    dominantShare: Number((top / counted).toFixed(4)),
    blank: top / counted > 0.985,
  };
}

const files = fs.readdirSync(DIR).filter((f) => /\.png$/.test(f)).map((f) => path.join(DIR, f)).sort();
const res = files.map(analyse);
const mism = res.filter((r) => !r.file.endsWith(`-${r.theme}.png`));
const blank = res.filter((r) => r.blank);
const oddDims = res.filter((r) => r.width !== 1080 || r.height !== 2400);

let manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
// Attach measured facts to each manifest entry so the manifest is self-describing.
for (const m of manifest.games) {
  const r = res.find((x) => x.file === `${m.id}-${m.theme}.png`);
  if (r && m.captured) {
    m.measuredTheme = r.theme;
    m.meanLuminance = r.meanLuminance;
    m.dominantShare = r.dominantShare;
    m.blank = r.blank;
    m.themeMatchesRequest = r.theme === m.theme;
    m.sha256 = r.sha256;
    m.bytes = r.bytes;
  }
}
manifest.verification = {
  analysedAt: new Date().toISOString(),
  frames: res.length,
  themeMismatches: mism.map((r) => r.file),
  blankFrames: blank.map((r) => r.file),
  unexpectedDimensions: oddDims.map((r) => `${r.file} ${r.width}x${r.height}`),
  allLightClaimedLight: res.filter((r) => r.file.endsWith('-light.png')).every((r) => r.theme === 'light'),
  allDarkClaimedDark: res.filter((r) => r.file.endsWith('-dark.png')).every((r) => r.theme === 'dark'),
};
fs.writeFileSync(path.join(DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest.verification, null, 1));
console.log('\nmean luminance range:',
  Math.min(...res.map((r) => r.meanLuminance)), 'to', Math.max(...res.map((r) => r.meanLuminance)));
