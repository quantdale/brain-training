// 076-f D3 — capture the Signal Watch GO control in both states.
//
// Walks cold-start -> deep link -> intro -> multi-step tutorial -> live board,
// then captures the shared GO Button (a GameButton, the D3 defect surface)
// in its ENABLED and post-trial DISABLED states with a real screenshot and
// the full accessibility hierarchy for each.
//
// Emulator-local ADB only. No host input, no controller.
//
// Every adb call is issued SYNCHRONOUSLY and sequentially: the emulator is
// memory-starved, and overlapping async shell commands collide on the same
// /sdcard path and leave an empty hierarchy.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GAME = 'attention-sustained-vigilance';
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
    out.push({ text: g('text'), rid: g('resource-id'), desc: g('content-desc'), enabled: g('enabled'), bounds: g('bounds') });
  }
  return out;
}
let dumpN = 0;
function dump(tag) {
  for (let a = 1; a <= 12; a++) {
    dumpN++;
    const remote = `/sdcard/d3k-${dumpN}.xml`;
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
  const remote = `/sdcard/d3k-${tag}.png`;
  adb(['shell', 'screencap', '-p', remote], 60000);
  try {
    execFileSync('adb', ['-s', DEVICE, 'pull', remote, path.join(OUT, `${tag}.png`)], { stdio: ['ignore', 'pipe', 'pipe'] });
    return path.join(OUT, `${tag}.png`);
  } catch { return null; }
}
function tap(x, y) { adb(['shell', 'input', 'tap', String(x), String(y)]); }
function ctr(b) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b);
  return m ? [Math.round((+m[1] + +m[3]) / 2), Math.round((+m[2] + +m[4]) / 2)] : null;
}
const goBtn = (d) => d.find((n) => new RegExp(`^${GAME}\\.(go-button|go)$`).test(n.rid || ''));
const DONE = /^(got it|start playing|done|next|skip|close|dismiss|i'm ready)$/i;

function main() {
  const report = { device: DEVICE, game: GAME, steps: [] };

  adb(['shell', 'am', 'force-stop', PKG]);
  sleepSync(1500);
  adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `braintraining://game/${GAME}`]);
  sleepSync(6000);

  // Walk the tutorial and start controls, reading each target's bounds from a
  // FRESH dump so a layout change cannot misdirect the tap.
  for (let step = 0; step < 14; step++) {
    const d = dump(`k-step${step}`);
    report.steps.push(`step${step} nodes=${d.length}`);
    const start = d.find((n) => n.clickable && n.rid === `${GAME}.start`);
    if (start) {
      const c = ctr(start.bounds);
      report.steps.push(`start found bounds=${start.bounds} ctr=${JSON.stringify(c)}`);
      if (c) { tap(c[0], c[1]); report.steps.push(`start tapped ${c}`); }
      sleepSync(6000);
      break;
    }
    const tut =
      d.find((n) => n.clickable && n.rid === `${GAME}.tutorial-next`) ||
      d.find((n) => n.clickable && (DONE.test((n.text || '').trim()) || DONE.test((n.desc || '').trim())));
    if (!tut) break;
    const c = ctr(tut.bounds);
    if (c) { tap(c[0], c[1]); report.steps.push(`tutorial ${step} ${c}`); }
    sleepSync(3500);
  }

  let d = dump('k-board');
  report.boardNodes = d.length;
  report.boardRids = d.filter((n) => n.rid && n.rid.startsWith(`${GAME}.`)).map((n) => `${n.rid}(${n.enabled})`);
  shot('k-board');

  let enabledGo = null;
  for (let i = 0; i < 20; i++) {
    d = dump(`k-en${i}`);
    const g = goBtn(d);
    if (g && g.enabled === 'true') { enabledGo = g; break; }
    sleepSync(1800);
  }
  report.enabledGo = enabledGo
    ? { rid: enabledGo.rid, label: enabledGo.text || enabledGo.desc, enabled: enabledGo.enabled, bounds: enabledGo.bounds }
    : null;
  if (enabledGo) shot('k-enabled-go');

  let disabledGo = null;
  for (let i = 0; i < 25; i++) {
    d = dump(`k-dis${i}`);
    const g = goBtn(d);
    if (g && g.enabled === 'false') { disabledGo = g; break; }
    sleepSync(2500);
  }
  report.disabledGo = disabledGo
    ? { rid: disabledGo.rid, label: disabledGo.text || disabledGo.desc, enabled: disabledGo.enabled, bounds: disabledGo.bounds }
    : null;
  if (disabledGo) shot('k-disabled-go');

  report.gameControls = d
    .filter((n) => n.clickable && (n.rid || '').startsWith(`${GAME}.`))
    .map((n) => ({ rid: n.rid, label: n.text || n.desc, enabled: n.enabled }));

  fs.writeFileSync(path.join(OUT, 'signal-watch-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
