#!/usr/bin/env node
// Minimal release-build driver: adb dump → parse testID bounds → tap center.
// Emulator-local input only (constitution §28). Used for standalone release
// certification where autobot's __DEV__ force-win path is unavailable.
import { execFileSync } from 'node:child_process';

const DEV = 'emulator-5554';
const adb = (...args) =>
  execFileSync('adb', ['-s', DEV, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
export function dump() {
  // /dev/tty streams the XML directly — avoids a device write + cat round-trip
  return adb('exec-out', 'uiautomator', 'dump', '/dev/tty');
}

export function findNode(xml, testId) {
  // Expo sets testID as resource-id WITHOUT the package prefix; native
  // widgets carry the prefix. Match both.
  for (const chunk of xml.split('<node')) {
    if (
      chunk.includes(`resource-id="${testId}"`) ||
      chunk.includes(`resource-id="com.braintraining.app:id/${testId}"`)
    ) {
      const m = chunk.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      const t = chunk.match(/text="([^"]*)"/);
      const d = chunk.match(/content-desc="([^"]*)"/);
      if (m) {
        const [x1, y1, x2, y2] = [+m[1], +m[2], +m[3], +m[4]];
        return { x: (x1 + x2) >> 1, y: (y1 + y2) >> 1, text: t?.[1] ?? '', desc: d?.[1] ?? '', bounds: [x1, y1, x2, y2] };
      }
    }
  }
  return null;
}

export function tap(testIdOrPos, maybeY) {
  const xml = dump();
  let x, y;
  if (typeof testIdOrPos === 'number') {
    x = testIdOrPos; y = maybeY;
  } else {
    const n = findNode(xml, testIdOrPos);
    if (!n) throw new Error(`testID not found: ${testIdOrPos}`);
    x = n.x; y = n.y;
  }
  adb('shell', 'input', 'tap', String(x), String(y));
  return { x, y };
}

export function waitFor(testId, budgetMs = 120000, intervalMs = 1500) {
  const end = Date.now() + budgetMs;
  while (Date.now() < end) {
    const xml = dump();
    const n = findNode(xml, testId);
    if (n) return { node: n, xml };
    sleepSync(intervalMs);
  }
  throw new Error(`timeout waiting for ${testId}`);
}

export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function texts() {
  const xml = dump();
  return [...xml.matchAll(/text="([^"]+)"/g)].map((m) => m[1]);
}

export function focus() {
  const out = adb('shell', 'dumpsys', 'window', 'displays');
  return (out.match(/mCurrentFocus=Window\{\S+ (\S+)\//) ?? [])[1] ?? 'unknown';
}
