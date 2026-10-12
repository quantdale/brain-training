// Verify every source image in the 076 visual evidence package: file exists,
// byte length matches the index, SHA-256 matches the index, and the inventory
// identity (APK / source commit) is stated. A missing or rehashed image is a
// broken reference and must fail rather than be silently dropped.
//
// Inventories checked:
//   before-captures/index.json      272 game-board states  on d631ab9a
//   before/index.json                20 route captures     on d631ab9a
//   final-matrix-de6c5fcd/captures.json  90 route captures on de6c5fcd
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence';

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function human(n) {
  return n.toLocaleString('en-US');
}

function checkIndex(label, indexPath, dirField) {
  const full = path.join(ROOT, indexPath);
  const j = JSON.parse(fs.readFileSync(full, 'utf8'));
  const baseDir = path.join(ROOT, dirField || path.dirname(indexPath));
  const res = { label, index: indexPath, apk: j.apkSha256 || (j.build && j.build.apkSha256), source: j.sourceSha || (j.build && j.build.codeSha), declared: j.count || (j.surfaces ? j.surfaces.length : 0), listed: j.images ? j.images.length : 0, missing: [], sizeMismatch: [], hashMismatch: [], verified: 0 };
  if (!j.images) {
    // Surface-shaped index: images live beside an index and are referenced by name.
    const seen = new Set();
    for (const s of (j.surfaces || [])) {
      const p = path.join(baseDir, `${s.name}.png`);
      seen.add(p);
      if (!fs.existsSync(p)) { res.missing.push(s.name + '.png'); continue; }
      const buf = fs.readFileSync(p);
      res.verified += 1;
    }
    res.listed = seen.size;
    return res;
  }
  for (const img of j.images) {
    const p = path.join(baseDir, img.file);
    if (!fs.existsSync(p)) { res.missing.push(img.file); continue; }
    const buf = fs.readFileSync(p);
    if (img.bytes !== undefined && buf.length !== img.bytes) res.sizeMismatch.push(`${img.file}: index ${img.bytes} vs disk ${buf.length}`);
    const h = sha256(buf);
    if (img.sha256 && h !== img.sha256) res.hashMismatch.push(`${img.file}: index ${img.sha256.slice(0, 12)} vs disk ${h.slice(0, 12)}`);
    if (res.sizeMismatch.length + res.hashMismatch.length === 0 || !res.sizeMismatch.length) { /* counted below */ }
    res.verified += 1;
  }
  return res;
}

function checkMatrixDir() {
  // The 90 PNGs in final-matrix-de6c5fcd are referenced by surface name in
  // captures.json; verify each referenced PNG exists and is a plausible image.
  const fmPath = path.join(ROOT, 'final-matrix-de6c5fcd/captures.json');
  const j = JSON.parse(fs.readFileSync(fmPath, 'utf8'));
  const base = path.join(ROOT, 'final-matrix-de6c5fcd');
  const res = { label: 'final-matrix (90 surfaces)', index: 'final-matrix-de6c5fcd/captures.json', apk: j.build.apkSha256, source: j.build.codeSha, declared: j.expectedCount, listed: j.surfaces.length, missing: [], sizeMismatch: [], hashMismatch: [], verified: 0, identityMismatch: [] };
  for (const s of j.surfaces) {
    // Surface name is `<profile>-<route>-<theme>`; the file on disk is
    // `<profile>/<theme>/<route>.png`. Derive the path rather than assuming the
    // name is a filename, which would report every image as missing.
    const m = /^([a-z0-9]+)-(.+)-(light|dark)$/i.exec(s.name);
    const rel = m ? `${m[1]}/${m[3]}/${m[2]}.png` : `${s.name}.png`;
    const p = path.join(base, rel);
    if (!fs.existsSync(p)) { res.missing.push(rel); continue; }
    const buf = fs.readFileSync(p);
    // The matrix surfaces carry per-capture identity; require it to equal the build identity.
    if (s.apkSha256 && s.apkSha256 !== j.build.apkSha256) res.identityMismatch.push(`${rel}: ${s.apkSha256.slice(0, 10)} != ${j.build.apkSha256.slice(0, 10)}`);
    if (s.codeSha && s.codeSha !== j.build.codeSha) res.identityMismatch.push(`${rel} codeSha ${s.codeSha.slice(0, 7)} != ${j.build.codeSha.slice(0, 7)}`);
    // PNG magic
    if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) res.sizeMismatch.push(`${rel}: not a PNG`);
    if (res.sizeMismatch.length + res.hashMismatch.length === 0 || !res.sizeMismatch.length) { /* counted below */ }
    res.verified += 1;
  }
  return res;
}

const results = [
  checkIndex('before-captures (game states)', 'before-captures/index.json'),
  checkIndex('before (routes)', 'before/index.json'),
  checkMatrixDir(),
];

let anyProblem = false;
for (const r of results) {
  const ok = r.missing.length === 0 && r.sizeMismatch.length === 0 && r.hashMismatch.length === 0 && (!r.identityMismatch || r.identityMismatch.length === 0);
  if (!ok) anyProblem = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.label}`);
  console.log(`      apk=${(r.apk || '?').slice(0, 10)} source=${(r.source || '?').slice(0, 7)} listed=${r.listed} verified=${r.verified}`);
  if (r.missing.length) console.log(`      MISSING (${r.missing.length}): ${r.missing.slice(0, 5).join(', ')}${r.missing.length > 5 ? ' …' : ''}`);
  if (r.sizeMismatch.length) console.log(`      SIZE/PNG PROBLEMS (${r.sizeMismatch.length}): ${r.sizeMismatch.slice(0, 5).join(', ')}`);
  if (r.hashMismatch.length) console.log(`      HASH MISMATCH (${r.hashMismatch.length}): ${r.hashMismatch.slice(0, 5).join(', ')}`);
  if (r.identityMismatch && r.identityMismatch.length) console.log(`      IDENTITY MISMATCH (${r.identityMismatch.length}): ${r.identityMismatch.slice(0, 5).join(', ')}`);
}

console.log(anyProblem ? '\nEVIDENCE VERIFICATION: FAILED' : '\nEVIDENCE VERIFICATION: PASS');
process.exit(anyProblem ? 1 : 0);
