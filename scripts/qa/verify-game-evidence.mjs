#!/usr/bin/env node
/** Verify the historical per-game image index; this cannot infer a screenshot's semantic state. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

import { inspectPng } from './capture-validation.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const GAME_ROOT = resolve(ROOT, 'apps/mobile/src/games');
const indexArg = process.argv.indexOf('--index');
const indexFile = indexArg >= 0 && process.argv[indexArg + 1] ? resolve(ROOT, process.argv[indexArg + 1]) : null;
if (!indexFile || !indexFile.startsWith(ROOT + sep)) {
  console.error('Usage: node scripts/qa/verify-game-evidence.mjs --index <repo-path> [--require-complete] [--require-committed]');
  process.exit(2);
}
const requireComplete = process.argv.includes('--require-complete');
const requireCommitted = process.argv.includes('--require-committed');
const issues = [];
let index;
try { index = JSON.parse(readFileSync(indexFile, 'utf8')); }
catch (error) {
  console.error(`[BLOCKED] cannot read game index: ${error.message}`);
  process.exit(2);
}
const dir = dirname(indexFile);
const images = Array.isArray(index.images) ? index.images : [];
const excluded = Array.isArray(index.excluded) ? index.excluded : [];
if (!Array.isArray(index.images) || !Array.isArray(index.excluded) || images.length !== index.count) {
  issues.push('missing/invalid index arrays or retained count mismatch');
}
const paths = [indexFile];
const seen = new Set();
for (const entry of [...images, ...excluded]) {
  const file = entry?.file;
  if (typeof file !== 'string' || !/^((rejected\/)?after-[a-z0-9-]+\.png)$/.test(file) ||
      (excluded.includes(entry) && !file.startsWith('rejected/')) ||
      (images.includes(entry) && file.startsWith('rejected/')) || seen.has(file)) {
    issues.push(`invalid, duplicated or incorrectly classified path: ${String(file)}`);
    continue;
  }
  seen.add(file);
  const path = resolve(dir, file);
  if (!path.startsWith(dir + sep)) { issues.push(`image outside index directory: ${file}`); continue; }
  paths.push(path);
  try {
    const bytes = readFileSync(path);
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || statSync(path).size !== bytes.length) {
      issues.push(`not a PNG: ${file}`);
    } else if (inspectPng(bytes).colors <= 2) {
      issues.push(`blank or undecodable app content: ${file}`);
    }
    if (!/^[a-f0-9]{64}$/.test(entry.sha256) ||
        createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      issues.push(`SHA-256 mismatch: ${file}`);
    }
    if (excluded.includes(entry) && !entry.reason) issues.push(`rejected image lacks reason: ${file}`);
  } catch (error) { issues.push(`unreadable image: ${file} (${error.code ?? error.message})`); }
}
for (const folder of ['', 'rejected']) {
  try {
    for (const file of readdirSync(resolve(dir, folder)).filter((name) => name.endsWith('.png'))) {
      const key = folder ? `${folder}/${file}` : file;
      if (!seen.has(key)) issues.push(`unindexed PNG: ${key}`);
    }
  } catch (error) {
    if (!(folder === 'rejected' && !excluded.length && error.code === 'ENOENT')) {
      issues.push(`cannot list ${folder || 'retained'} images: ${error.code ?? error.message}`);
    }
  }
}
const ids = readdirSync(GAME_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((id) => {
    try { return statSync(resolve(GAME_ROOT, id, 'game.json')).isFile(); }
    catch { return false; }
  });
const states = ['active', 'feedback', 'pause', 'result'];
const counts = Object.fromEntries(states.map((state) => [state, 0]));
const missing = [];
for (const id of ids) for (const state of states) {
  if (images.some((entry) => entry.file === `after-${id}-${state}.png`)) counts[state]++;
  else missing.push(`${id}/${state}`);
}
if (requireComplete && missing.length) issues.push(`missing core game states: ${missing.join(', ')}`);
if (requireCommitted) {
  try {
    const tracked = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split(/\r?\n/));
    const relPaths = paths.map((path) => relative(ROOT, path).replace(/\\/g, '/'));
    for (const file of relPaths) if (!tracked.has(file)) issues.push(`not committed at HEAD: ${file}`);
    const changed = execFileSync('git', ['diff', 'HEAD', '--name-only', '--', ...relPaths],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim();
    if (changed) issues.push(`changed since HEAD: ${changed.replace(/\r?\n/g, ', ')}`);
  } catch (error) { issues.push(`cannot check Git identity: ${error.message}`); }
}
if (issues.length) {
  console.error(`[FAIL] ${issues.length} game evidence issue(s):\n${issues.join('\n')}`);
  process.exit(1);
}
console.log(`[PASS] index integrity${requireCommitted ? ' and committed identity' : ''}: ${images.length} retained, ${excluded.length} rejected PNGs`);
console.log(`[${missing.length ? 'PARTIAL' : 'PASS'}] ${ids.length} games, ${ids.length * states.length - missing.length}/${ids.length * states.length} core frames; A ${counts.active}/${ids.length}, F ${counts.feedback}/${ids.length}, P ${counts.pause}/${ids.length}, R ${counts.result}/${ids.length}`);
if (missing.length) console.log(`NOT VALIDATED: ${missing.join(', ')}`);
console.log('State semantics require individual visual assessment; image integrity does not prove that a frame depicts its label or the final APK.');
