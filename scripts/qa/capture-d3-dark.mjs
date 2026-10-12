// 076-f D3 — capture the shared Button disabled in the DARK theme with a proper
// cold re-start per theme, so the app re-reads the system theme.
//
// The first dark-theme capture measured 2.75:1, implausible against the token
// pair (dark textSecondary #B9BABC on dark backgroundElement #17181B = 9.14:1).
// The likely cause was the uimode change not propagating to the running app
// before the screenshot. This force-stops the app AFTER the theme change so it
// re-renders from scratch, which removes that variable.
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
    const g = (k) => (new RegExp(`${k}="([^\"]*)\"`).exec(a) || [, ''])[1];
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
    const remote = `/sdcard/d3g2-${dumpN}.xml`;
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
  const remote = `/sdcard/d3g2-${tag}.png`;
  adb(['shell', 'screencap', '-p', remote], 60000);
  try {
    execFileSync('adb', ['-s', DEVICE, 'pull', remote, path.join(OUT, `${tag}.png`)], { stdio: ['ignore', 'pipe', 'pipe'] });
    return path.join(OUT, `${tag}.png`);
  } catch { return null; }
}
function deepLink(uri) { adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', uri]); }

function capture(tag) {
  adb(['shell', 'am', 'force-stop', PKG]);
  sleepSync(2000);
  deepLink('braintraining://profile');
  sleepSync(7000);
  const d = dump(tag);
  return { d, png: shot(tag) };
}

function main() {
  const report = { device: DEVICE, at: new Date().toISOString() };

  adb(['shell', 'cmd', 'uimode', 'night', 'yes']);
  sleepSync(4000);
  const k = capture('g2-dark-profile');
  report.dark = {
    nodes: k.d.length,
    disabled: k.d.filter((n) => n.clickable && n.enabled === 'false').map((n) => ({ rid: n.rid, bounds: n.bounds })),
    png: k.png ? path.basename(k.png) : null,
  };

  fs.writeFileSync(path.join(OUT, 'g2-dark-theme.json'), `${JSON.stringify(report, null, 2)}\\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
