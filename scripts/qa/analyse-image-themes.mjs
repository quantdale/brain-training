// Classify the apparent theme of every image across the three 076 visual
// inventories, so pairing can be done on measured theme rather than on a
// filename that carries no theme marker.
//
// Writes evidence/image-themes.json and prints a summary. A pair whose two sides
// disagree on theme is a mismatched comparison and is reported as such.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import crypto from 'node:crypto';

const EV = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence';
const CD = 'openspec/changes/076-f-final-product-certification/evidence';

function decode(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
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
function analyse(file, inventory) {
  const buf = fs.readFileSync(file);
  const img = decode(buf);
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
  let top = 0;
  for (const v of colours.values()) if (v > top) top = v;
  const mean = sum / counted;
  return {
    file,
    inventory,
    width: img.w,
    height: img.h,
    bytes: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    meanLuminance: Number(mean.toFixed(4)),
    theme: mean >= 0.35 ? 'light' : 'dark',
    dominantShare: Number((top / counted).toFixed(4)),
    dynamicRange: Number((max - min).toFixed(4)),
  };
}
function walk(dir, inventory, acc) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, inventory, acc);
    else if (/\.png$/i.test(e.name)) acc.push(analyse(p, inventory));
  }
  return acc;
}

const all = [];
walk(path.join(EV, 'before-captures'), 'before-captures(d631ab9a)', all);
walk(path.join(EV, 'before'), 'before(d631ab9a)', all);
walk(path.join(EV, 'final-matrix-de6c5fcd'), 'final-matrix(de6c5fcd)', all);
walk(CD, 'current-device(42 rows)', all);

const summary = {};
for (const r of all) {
  const k = `${r.inventory}|${r.theme}`;
  summary[k] = (summary[k] || 0) + 1;
}
fs.writeFileSync(path.join(EV, 'image-themes.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: all.length, images: all }, null, 2));
console.log('images analysed:', all.length);
for (const [k, v] of Object.entries(summary).sort()) console.log(`  ${k}: ${v}`);
