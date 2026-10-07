#!/usr/bin/env node
/** Verify the complete screenshot matrix and its actual image/XML bytes. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { captureIssues, inspectPng, routeArrived } from './capture-validation.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const index = process.argv.indexOf('--manifest');
const requireCommitted = process.argv.includes('--require-committed');
if (index < 0 || !process.argv[index + 1]) {
  console.error('Usage: node scripts/qa/verify-capture-evidence.mjs --manifest <path> [--require-committed]');
  process.exit(2);
}
const manifestPath = resolve(ROOT, process.argv[index + 1]);
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`[BLOCKED] cannot read capture manifest: ${error.message}`);
  process.exit(2);
}
const issues = captureIssues(manifest);
if (!/^[a-f0-9]{64}$/.test(manifest.build?.apkSha256 ?? '')) {
  issues.push('installed APK SHA-256 missing');
}
const paths = [manifestPath];
for (const entry of manifest.surfaces ?? []) {
  for (const [field, shaField, bytesField] of [['png', 'pngSha256', 'pngBytes'], ['xml', 'xmlSha256', 'xmlBytes']]) {
    const filename = entry[field];
    if (typeof filename !== 'string' || isAbsolute(filename) || !filename.trim()) {
      issues.push(`missing or absolute ${field}: ${entry.surface}`);
      continue;
    }
    const path = resolve(ROOT, filename);
    if (!path.startsWith(ROOT + sep) || dirname(path) !== resolve(dirname(manifestPath), entry.profile, entry.theme)) {
      issues.push(`capture outside declared run: ${filename}`);
      continue;
    }
    paths.push(path);
    try {
      const bytes = readFileSync(path);
      if (bytes.length !== entry[bytesField] || statSync(path).size !== entry[bytesField]) {
        issues.push(`byte count mismatch: ${filename}`);
      }
      if (createHash('sha256').update(bytes).digest('hex') !== entry[shaField]) {
        issues.push(`SHA-256 mismatch: ${filename}`);
      }
      if (field === 'png') {
        if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
          issues.push(`not a PNG: ${filename}`);
        } else {
          const inspection = inspectPng(bytes);
          if (inspection.colors <= 2) issues.push(`uniform app-content pixels: ${filename}`);
          if (inspection.statusBarDiscontinuity) issues.push(`clipped status-bar pixels: ${filename}`);
        }
      }
      if (field === 'xml') {
        const xml = bytes.toString('utf8');
        if (!routeArrived(xml, manifest.package, entry.expectedMarkers ?? [], entry.expectAll) ||
            (entry.expectedText && !xml.includes(`text="${entry.expectedText}"`))) {
          issues.push(`app-owned route marker or expected game title missing: ${filename}`);
        }
      }
    } catch (error) {
      issues.push(`missing or unreadable capture: ${filename} (${error.code ?? error.message})`);
    }
  }
}
if (manifest.expectedCount !== manifest.surfaces?.length) {
  issues.push(`expectedCount=${manifest.expectedCount}, captured=${manifest.surfaces?.length ?? 0}`);
}
if (requireCommitted) {
  try {
    const tracked = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split(/\r?\n/));
    for (const path of paths) {
      const rel = relative(ROOT, path).replace(/\\/g, '/');
      if (!tracked.has(rel)) issues.push(`not committed at HEAD: ${rel}`);
    }
    const changed = execFileSync('git', ['diff', 'HEAD', '--name-only', '--', ...paths.map((path) => relative(ROOT, path))], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (changed.trim()) issues.push(`changed since HEAD: ${changed.trim().replace(/\r?\n/g, ', ')}`);
  } catch (error) {
    issues.push(`cannot verify Git identity (${error.message})`);
  }
}
if (issues.length) {
  console.error(`[FAIL] ${issues.length} evidence issue(s):\n${issues.join('\n')}`);
  process.exit(1);
}
console.log(`[PASS] ${manifest.surfaces.length}/${manifest.expectedCount} immutable app-owned PNG/XML pairs${requireCommitted ? ' committed at HEAD' : ''}`);
