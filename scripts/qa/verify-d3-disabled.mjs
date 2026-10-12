// 076-f D3 — capture the shared Button in its DISABLED state on a real device,
// via the rewards route where the Buy control is disabled when the balance is
// insufficient. That is a real, deterministic disabled shared Button that
// renders the repaired treatment, and it is reachable in one deep link.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PKG = 'com.braintraining.app';
const DEVICE = process.env.BT_DEVICE || 'emulator-5570';
const OUT = path.resolve('openspec/changes/076-f-final-product-certification/evidence/d3-verify');
fs.mkdirSync(OUT, { recursive: true });
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function adb(args, timeout = 120000) {
  try {
    return execFileSync('adb', ['-s', DEVICE, ...args], {
      encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    return String((e.stdout || '') + (e.stderr || '') + (e.message || ''));
  }
}
function parseNodes(raw) {
  const out = [];
  const re = /<node\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(raw))) {
    const a = m[1];
    const g = (k) => (new RegExp(`${k}="([^"]*)"`).exec(a) || [, ''])[1];
    out.push({
      text: g('text'), rid: g('resource-id'), desc: g('content-desc'),
      enabled: g('enabled'), clickable: g('clickable') === 'true', bounds: g('bounds'),
    });
  }
  return out;
}
let dumpN = 0;
function dump(tag) {
  for (let a = 1; a <= 12; a++) {
    dumpN++;
    const remote = `/sdcard/d3e-${dumpN}.xml`;
    adb(['shell', 'uiautomator', 'dump', remote], 60000);
    try {
      execFileSync('adb', ['-s', DEVICE, 'pull', remote, path.join(OUT, `${tag}.xml`)], { stdio: ['ignore', 'pipe', 'pipe'] });
      const raw = fs.readFileSync(path.join(OUT, `${tag}.xml`), 'utf8');
      if (raw.includes('<node ')) return parseNodes(raw);
    } catch { /* retry */ }
    sleepSync(600);
  }
  return [];
}
function shot(tag) {
  const remote = `/sdcard/d3e-${tag}.png`;
  adb(['shell', 'screencap', '-p', remote], 60000);
  try {
    execFileSync('adb', ['-s', DEVICE, 'pull', remote, path.join(OUT, `${tag}.png`)], { stdio: ['ignore', 'pipe', 'pipe'] });
    return path.join(OUT, `${tag}.png`);
  } catch { return null; }
}
function deepLink(uri) { adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', uri]); }
function tap(x, y) { adb(['shell', 'input', 'tap', String(x), String(y)]); }
function ctr(b) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b);
  return m ? [Math.round((+m[1] + +m[3]) / 2), Math.round((+m[2] + +m[4]) / 2)] : null;
}

const ROUTES = [
  ['e-rewards', 'braintraining://rewards'],
  ['e-profile', 'braintraining://profile'],
  ['e-progress', 'braintraining://progress'],
  ['e-data', 'braintraining://data-management'],
];

function main() {
  const report = { device: DEVICE, at: new Date().toISOString(), captures: [] };
  adb(['shell', 'am', 'force-stop', PKG]);
  sleepSync(1500);

  for (const [tag, uri] of ROUTES) {
    deepLink(uri);
    sleepSync(5500);
    const d = dump(tag);
    report.captures.push({
      route: uri,
      nodes: d.length,
      disabledControls: d
        .filter((n) => n.clickable && n.enabled === 'false')
        .map((n) => ({ rid: n.rid, label: n.text || n.desc, bounds: n.bounds })),
      enabledControlCount: d.filter((n) => n.clickable && n.enabled === 'true').length,
    });
    shot(tag);
  }

  fs.writeFileSync(path.join(OUT, 'disabled-button-routes.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.captures.map((c) => ({ route: c.route, disabled: c.disabledControls, enabled: c.enabledControlCount })), null, 2));
}

main();
