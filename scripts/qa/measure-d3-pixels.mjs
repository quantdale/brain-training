// 076-f D3 — measure the rendered pixels of a DISABLED shared Button.
//
// The unit tests prove the treatment is applied; this measures what the DEVICE
// actually painted. It reads the captured screenshot, samples the label area of
// a disabled button and the button's own fill, and computes the WCAG contrast
// ratio between them.
//
// PNG decoding is done with zlib (no image dependency): the device emits RGBA
// PNGs straight from screencap.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('openspec/changes/076-f-final-product-certification/evidence/d3-verify');
const PNG = path.join(OUT, process.argv[2] || 'e-profile.png');
const DEVICE = 'emulator-5570';

/** Minimal PNG decoder for the RGBA8/RGB8 output screencap produces. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : 3;
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const stride = width * channels;
  const out = Buffer.alloc(width * height * channels);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 0xff;
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { width, height, channels, data: out };
}

function px(img, x, y) {
  const i = (y * img.width + x) * img.channels;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
function lum(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function hex(rgb) {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function main() {
  if (!fs.existsSync(PNG)) {
    console.error('missing capture: ' + PNG);
    process.exit(2);
  }
  const img = decodePng(fs.readFileSync(PNG));
  const out = { image: path.basename(PNG), width: img.width, height: img.height, buttons: [] };

  // Regions to measure, in `x1,y1,x2,y2` order. Defaults to the
  // Profile route's disabled Buy controls; pass --region rid,x1,y1,x2,y2 to
  // measure any other disabled control.
  let regions = [
    { rid: 'streak-buy-freeze', b: [793, 1492, 1038, 1618] },
    { rid: 'streak-buy-shield', b: [793, 1670, 1038, 1796] },
  ];
  const regionArg = process.argv.indexOf('--region');
  if (regionArg > 0 && process.argv[regionArg + 1]) {
    const parts = String(process.argv[regionArg + 1]).split(',');
    const b = parts.slice(1).map(Number);
    if (parts.length === 5 && b.every((n) => Number.isFinite(n))) {
      regions = [{ rid: parts[0], b }];
    }
  }
  for (const r of regions) {
    const [x1, y1, x2, y2] = r.b;
    // Collect every pixel strictly inside the border, then classify by luminance
    // against the region's own extremes. The fill is the dominant background
    // band; the LABEL is the set of pixels furthest from it. Using the region's
    // own extremes makes this scale-free and independent of which theme it is.
    const pxls = [];
    for (let dy = 2; dy < y2 - y1 - 2; dy++) {
      for (let dx = 2; dx < x2 - x1 - 2; dx++) {
        const p = px(img, x1 + dx, y1 + dy);
        pxls.push({ p, l: lum(p) });
      }
    }
    // Classify by exact colour, not by luminance percentiles: a disabled
    // Button's fill can be >95% of the region, which makes a 5th/95th
    // percentile split degenerate (both land on the fill).
    const hexOf = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('');
    const counts = new Map();
    for (const s of pxls) {
      const k = hexOf(s.p);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const parse = (h) => [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
    // FILL = the most common colour (the background band).
    const fillHex = ranked[0][0];
    // LABEL = the most common colour that is NOT the fill. This is the glyph
    // colour: it carries the same pixel count in both themes (the same text at
    // the same size), while stray antialiasing/highlight pixels are far rarer.
    const nonFill = ranked.filter(([c]) => c !== fillHex);
    const labelHex = nonFill.length ? nonFill[0][0] : fillHex;
    const fill = parse(fillHex);
    const label = parse(labelHex);
    out.buttons.push({
      rid: r.rid,
      bounds: r.b,
      fill: `#${fillHex}`,
      label: `#${labelHex}`,
      labelPixels: counts.get(labelHex) || 0,
      labelShare: Number((100 * (counts.get(labelHex) || 0) / pxls.length).toFixed(2)),
      runnerUp: nonFill.length > 1 ? `#${nonFill[1][0]}` : null,
      contrast: Number(contrast(fill, label).toFixed(2)),
      aa: contrast(fill, label) >= 4.5,
    });
  }

  fs.writeFileSync(path.join(OUT, path.basename(PNG).replace(/\.png$/, '-measurement.json')), `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify(out, null, 2));
}

main();
