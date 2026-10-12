// Classify each image's apparent theme (light/dark) by mean relative luminance,
// so the before/after pairing does not have to guess. Also reports the PNG
// dimensions and whether the frame looks blank or uniform, which is the check for
// a capture that does not actually depict its claimed state.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
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
  const img = decode(fs.readFileSync(file));
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
    meanLuminance: Number(mean.toFixed(4)),
    theme: mean >= 0.35 ? 'light' : 'dark',
    dominantShare: Number((top / counted).toFixed(4)),
    uniform: top / counted > 0.97,
  };
}

const files = process.argv.slice(2);
const out = [];
for (const f of files) {
  try { out.push(analyse(f)); } catch (e) { out.push({ file: f, error: String(e.message) }); }
}
console.log(JSON.stringify(out, null, 1));
