#!/usr/bin/env node
/** Campaign 080 Wave I — Odd One Out cover correction: evidence + verification.
 *
 * The corrected composition is NOT authored here. It lives in the canonical
 * Campaign 078 art source, `scripts/artwork/memory-attention-speed.mjs#oddOneOut()`,
 * and is compiled by `scripts/artwork/generate-covers.mjs` like every other
 * cover. This script exists only to:
 *   1. verify the shipped asset is exactly what the canonical pipeline emits
 *      (no hand-edited drift can survive), and
 *   2. render before/after evidence at the real mobile display sizes.
 *
 * STATUS: technically sound reversible CANDIDATE PENDING OWNER ACCEPTANCE.
 * The owner has NOT approved its final aesthetic quality.
 *
 * Usage (from repo root):
 *   node scripts/qa/covers/odd-one-out-candidate.mjs            # write evidence
 *   node scripts/qa/covers/odd-one-out-candidate.mjs --verify   # assert canonical, no writes
 *
 * Rollback (fully reversible, no residue):
 *   git checkout HEAD -- apps/mobile/assets/game-covers/attention-odd-one-out.png \
 *                        apps/mobile/assets/game-covers/inventory.json \
 *                        apps/mobile/src/components/discovery/game-cover-artwork.generated.ts \
 *                        openspec/changes/078-game-cover-visual-identities/evidence/contact-sheet-dark.png \
 *                        openspec/changes/078-game-cover-visual-identities/evidence/contact-sheet-light.png \
 *                        scripts/artwork/memory-attention-speed.mjs
 *   # then: node scripts/artwork/generate-covers.mjs
 * A byte-pinned snapshot of the pre-change cover is also kept at
 * `scripts/qa/covers/originals/attention-odd-one-out.png` (SHA-256 below).
 *
 * Evidence is gitignored native evidence: `qa-artifacts/080/odd-one-out-cover/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const COVER = path.join(ROOT, 'apps/mobile/assets/game-covers/attention-odd-one-out.png');
const ORIGINAL = path.join(ROOT, 'scripts/qa/covers/originals/attention-odd-one-out.png');
const EVIDENCE = path.join(ROOT, 'qa-artifacts/080/odd-one-out-cover');
const FONT = path.join(ROOT, 'apps/mobile/assets/fonts/Manrope-Bold.ttf');

const ORIGINAL_SHA256 = '1f673c84c8fe31c3a9012be355a653cb637dfae054686e5e6c6ad8807358bbce';

const require = createRequire(path.join(ROOT, 'apps/mobile/package.json'));
const { Resvg } = require('@resvg/resvg-js');
const render = (svg) => new Resvg(svg, {
  font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Manrope' },
}).render().asPng();

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** Assert the shipped asset is exactly what the canonical generator emits. */
function assertCanonical() {
  execFileSync(process.execPath, ['scripts/artwork/generate-covers.mjs', '--check'], {
    cwd: ROOT, stdio: 'pipe', timeout: 60_000,
  });
}

/** Downscaled render through the same resvg pipeline (raster in SVG <image>). */
function downscale(png, w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 512 320">`
    + `<image href="data:image/png;base64,${png.toString('base64')}" width="512" height="320"/></svg>`;
  return render(svg);
}

function main() {
  const verifyOnly = process.argv.includes('--verify');

  assertCanonical();
  console.log('OK  generate-covers.mjs --check: the shipped cover is canonical, not hand-edited.');

  const current = fs.readFileSync(COVER);
  const before = fs.readFileSync(ORIGINAL);
  if (sha256(before) !== ORIGINAL_SHA256) {
    throw new Error(`pinned original hash mismatch: ${sha256(before)} != ${ORIGINAL_SHA256}`);
  }
  console.log(`OK  original  sha256 ${sha256(before)} (${before.length} bytes)`);
  console.log(`OK  candidate sha256 ${sha256(current)} (${current.length} bytes)`);
  if (sha256(current) === ORIGINAL_SHA256) {
    console.log('NOTE: shipped cover is still the original — the correction is not currently applied.');
  }

  if (verifyOnly) return;

  // Real display sizes from GameWorldArt / game-cover-artwork.tsx (1.6-aspect
  // frame), rendered at 1x density — the tightest legibility case.
  const sizes = [[102, 64, 'thumbnail'], [179, 112, 'card'], [192, 120, 'hero'], [288, 180, 'stage']];
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, 'before-attention-odd-one-out.png'), before);
  fs.writeFileSync(path.join(EVIDENCE, 'after-attention-odd-one-out.png'), current);
  for (const [w, h, name] of sizes) {
    fs.writeFileSync(path.join(EVIDENCE, `before-mobile-${name}-${w}x${h}.png`), downscale(before, w, h));
    fs.writeFileSync(path.join(EVIDENCE, `after-mobile-${name}-${w}x${h}.png`), downscale(current, w, h));
  }
  console.log(`Evidence -> ${path.relative(ROOT, EVIDENCE)} (before/after at 512x320 + ${sizes.map(([w, h]) => `${w}x${h}`).join(', ')})`);
}

main();
