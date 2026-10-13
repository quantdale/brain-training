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
import { pathToFileURL } from 'node:url';

const ROOT = 'openspec/changes/076-product-wide-ui-ux-reboot/evidence';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHA256 = /^[a-f0-9]{64}$/i;

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function checkHash(res, rel, buf, recorded, field) {
  if (typeof recorded !== 'string' || !SHA256.test(recorded)) {
    res.hashMismatch.push(`${rel}: missing or malformed recorded ${field}`);
    return false;
  }
  const actual = sha256(buf);
  if (actual !== recorded.toLowerCase()) {
    res.hashMismatch.push(`${rel}: index ${recorded.slice(0, 12)} vs disk ${actual.slice(0, 12)}`);
    return false;
  }
  return true;
}

export function checkIndex(label, indexPath, dirField, evidenceRoot = ROOT) {
  const full = path.join(evidenceRoot, indexPath);
  const j = JSON.parse(fs.readFileSync(full, 'utf8'));
  const baseDir = path.join(evidenceRoot, dirField || path.dirname(indexPath));
  const res = { label, index: indexPath, apk: j.apkSha256 || (j.build && j.build.apkSha256), source: j.sourceSha || (j.build && j.build.codeSha), declared: j.count || (j.surfaces ? j.surfaces.length : 0), listed: j.images ? j.images.length : 0, missing: [], sizeMismatch: [], hashMismatch: [], verified: 0 };
  if (!j.images) {
    // Surface-shaped index: images live beside an index and are referenced by name.
    const seen = new Set();
    for (const s of (j.surfaces || [])) {
      const p = path.join(baseDir, `${s.name}.png`);
      seen.add(p);
      if (!fs.existsSync(p)) { res.missing.push(s.name + '.png'); continue; }
      const buf = fs.readFileSync(p);
      const sizeOk = Number.isSafeInteger(s.pngBytes) && s.pngBytes === buf.length;
      if (!sizeOk) res.sizeMismatch.push(`${s.name}.png: index ${s.pngBytes} vs disk ${buf.length}`);
      const hashOk = checkHash(res, `${s.name}.png`, buf, s.pngSha256, 'pngSha256');
      if (sizeOk && hashOk) res.verified += 1;
    }
    res.listed = seen.size;
    return res;
  }
  for (const img of j.images) {
    const p = path.join(baseDir, img.file);
    if (!fs.existsSync(p)) { res.missing.push(img.file); continue; }
    const buf = fs.readFileSync(p);
    const sizeOk = img.bytes === undefined || buf.length === img.bytes;
    if (!sizeOk) res.sizeMismatch.push(`${img.file}: index ${img.bytes} vs disk ${buf.length}`);
    const hashOk = checkHash(res, img.file, buf, img.sha256, 'sha256');
    if (sizeOk && hashOk) res.verified += 1;
  }
  return res;
}

export function checkMatrixDir(evidenceRoot = ROOT) {
  // The 90 PNGs in final-matrix-de6c5fcd are referenced by surface name in
  // captures.json. Compare bytes against the original recorded digest; never
  // repair a mismatch by rehashing the manifest to fit files on disk.
  const fmPath = path.join(evidenceRoot, 'final-matrix-de6c5fcd/captures.json');
  const j = JSON.parse(fs.readFileSync(fmPath, 'utf8'));
  const base = path.join(evidenceRoot, 'final-matrix-de6c5fcd');
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
    let valid = true;
    // The matrix surfaces carry per-capture identity; require it to equal the build identity.
    if (s.apkSha256 && s.apkSha256 !== j.build.apkSha256) {
      res.identityMismatch.push(`${rel}: ${s.apkSha256.slice(0, 10)} != ${j.build.apkSha256.slice(0, 10)}`);
      valid = false;
    }
    if (s.codeSha && s.codeSha !== j.build.codeSha) {
      res.identityMismatch.push(`${rel} codeSha ${s.codeSha.slice(0, 7)} != ${j.build.codeSha.slice(0, 7)}`);
      valid = false;
    }
    if (!Number.isSafeInteger(s.pngBytes) || s.pngBytes < 8 || buf.length !== s.pngBytes) {
      res.sizeMismatch.push(`${rel}: missing/malformed pngBytes or index ${s.pngBytes} vs disk ${buf.length}`);
      valid = false;
    }
    if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
      res.sizeMismatch.push(`${rel}: not a PNG`);
      valid = false;
    }
    const hashOk = checkHash(res, rel, buf, s.pngSha256, 'pngSha256');
    // A failed row must not inflate the count of successfully verified PNGs.
    if (valid && hashOk) res.verified += 1;
  }
  return res;
}

export function verifyVisualEvidence(evidenceRoot = ROOT) {
  return [
    checkIndex('before-captures (game states)', 'before-captures/index.json', undefined, evidenceRoot),
    checkIndex('before (routes)', 'before/index.json', undefined, evidenceRoot),
    checkMatrixDir(evidenceRoot),
  ];
}

export function evidenceResultPassed(r) {
  return r.missing.length === 0 && r.sizeMismatch.length === 0 && r.hashMismatch.length === 0 && (!r.identityMismatch || r.identityMismatch.length === 0);
}

function runCli() {
  const results = verifyVisualEvidence();
  let anyProblem = false;
  for (const r of results) {
    const ok = evidenceResultPassed(r);
    if (!ok) anyProblem = true;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.label}`);
    console.log(`      apk=${(r.apk || '?').slice(0, 10)} source=${(r.source || '?').slice(0, 7)} listed=${r.listed} verified=${r.verified}`);
    if (r.missing.length) console.log(`      MISSING (${r.missing.length}): ${r.missing.slice(0, 5).join(', ')}${r.missing.length > 5 ? ' …' : ''}`);
    if (r.sizeMismatch.length) console.log(`      SIZE/PNG PROBLEMS (${r.sizeMismatch.length}): ${r.sizeMismatch.slice(0, 5).join(', ')}`);
    if (r.hashMismatch.length) console.log(`      HASH MISMATCH (${r.hashMismatch.length}): ${r.hashMismatch.slice(0, 5).join(', ')}`);
    if (r.identityMismatch && r.identityMismatch.length) console.log(`      IDENTITY MISMATCH (${r.identityMismatch.length}): ${r.identityMismatch.slice(0, 5).join(', ')}`);
  }

  console.log(anyProblem ? '\nEVIDENCE VERIFICATION: FAILED' : '\nEVIDENCE VERIFICATION: PASS');
  return anyProblem ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runCli();
}
