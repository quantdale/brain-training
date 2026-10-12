// Capture the 42 game TUTORIAL surfaces on the repaired terminal APK so a
// theme-matched before/after pair exists for the "tutorial" requirement.
//
// Constraints honoured here, in order of importance:
//   * ZERO ARTEMIS calls. A tutorial screen is reachable by deep link with no
//     gameplay, so no journey is launched and no score is produced. Nothing here
//     is acceptance evidence for gameplay; it is a static visual frame only.
//   * No production source edit.
//   * Emulator-local only: adb, no host mouse/keyboard (AGENTS.md host
//     interaction prohibition).
//   * Provenance preserved: every frame records the installed APK's SHA-256
//     read from the device, the device serial, the theme actually applied, and
//     the hierarchy that proves which surface was on screen.
//
// The before tutorials were all measured light-theme (scripts/qa/analyse-image-themes.mjs),
// so light is captured to make the pair theme-matched. Dark is captured too, but
// only light is pair-matched, because no dark-theme before tutorial exists.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKG = 'com.braintraining.app';
const OUT = path.join(ROOT, 'openspec/changes/076-product-wide-ui-ux-reboot/evidence/terminal-tutorials-c8c3d46c');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const DEVICE = arg('device', process.env.BT_DEVICE || process.env.QA_DEVICE || 'emulator-5570');

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function adb(a, timeout = 120000) {
  try {
    return execFileSync('adb', ['-s', DEVICE, ...a], { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { return String((e.stdout || '') + (e.stderr || '') + (e.message || '')); }
}
function sha256File(p) { return createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

/** The 42 registered games, from the generated registry (single source of truth). */
function loadGames() {
  const src = fs.readFileSync(path.join(ROOT, 'apps/mobile/src/registry/registry.generated.ts'), 'utf8');
  const out = [];
  const re = /id:\s*"([a-z0-9-]+)"[\s\S]{0,200}?name:\s*"([^"]+)"[\s\S]{0,400}?primaryCategory:\s*"([A-Za-z& ]+)"/g;
  let m;
  while ((m = re.exec(src))) out.push({ id: m[1], name: m[2], category: m[3] });
  return out;
}

const games = loadGames();
fs.mkdirSync(OUT, { recursive: true });

const manifest = { capturedAt: new Date().toISOString(), device: DEVICE, package: PKG, themes: [], games: [] };

// --- device / APK identity, read from the device rather than assumed ---------
adb(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
const apkPath = adb(['shell', 'pm', 'path', PKG]).replace(/^package:/, '').trim();
const apkHash = apkPath ? adb(['exec-out', `sha256sum ${apkPath}`]).split(/\s+/)[0].trim() : null;
const density = adb(['shell', 'wm', 'density']).replace(/[^0-9]/g, '');
const size = adb(['shell', 'wm', 'size']).replace(/[^0-9x]/, '').trim();

for (const theme of ['light', 'dark']) {
  adb(['shell', 'cmd', 'uimode', 'night', theme === 'dark' ? 'yes' : 'no']);
  sleep(3500);
  for (const g of games) {
    adb(['shell', 'am', 'force-stop', PKG]);
    sleep(1000);
    adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `braintraining://game/${g.id}`]);
    sleep(3800);

    const base = `${g.id}-${theme}`;
    const png = path.join(OUT, `${base}.png`);
    const xml = path.join(OUT, `${base}.xml`);
    const remotePng = `/sdcard/tut-${g.id}-${theme}.png`;
    const remoteXml = `/sdcard/tut-${g.id}-${theme}.xml`;

    adb(['shell', 'screencap', '-p', remotePng]);
    adb(['shell', 'uiautomator', 'dump', remoteXml], 60000);
    let okPng = false;
    let okXml = false;
    try { execFileSync('adb', ['-s', DEVICE, 'pull', remotePng, png], { stdio: ['ignore', 'pipe', 'pipe'] }); okPng = fs.existsSync(png) && fs.statSync(png).size > 1000; } catch { /* recorded below */ }
    try { execFileSync('adb', ['-s', DEVICE, 'pull', remoteXml, xml], { stdio: ['ignore', 'pipe', 'pipe'] }); okXml = fs.existsSync(xml) && fs.statSync(xml).size > 200; } catch { /* recorded below */ }

    // Which surface is actually on screen? Read the hierarchy rather than assume.
    const controls = [];
    if (okXml) {
      const raw = fs.readFileSync(xml, 'utf8');
      const re = /<node\b([^>]*?)\/?>/g;
      let m;
      while ((m = re.exec(raw))) {
        const a = m[1];
        const get = (k) => (new RegExp(`${k}="([^"]*)"`).exec(a) || [, ''])[1];
        const rid = get('resource-id');
        const clk = get('clickable') === 'true';
        const en = get('enabled') === 'true';
        if (clk) controls.push(`${rid}|${get('text') || get('content-desc')}|${en}`);
      }
    }
    // The intro is on screen when the game's own namespace exposes a start control.
    const hasStart = controls.some((c) => c.startsWith(`${g.id}.start`));
    const hasBack = controls.some((c) => c.startsWith(`${g.id}.intro-back`));

    manifest.games.push({
      id: g.id, name: g.name, category: g.category, theme,
      captured: okPng, hierarchyCaptured: okXml,
      // The tutorial surface is proven by the presence of the intro's own controls,
      // not by the fact that a deep link was issued.
      introSurface: hasStart && hasBack,
      gameControlCount: controls.filter((c) => c.startsWith(`${g.id}.`)).length,
      file: okPng ? path.basename(png) : null,
      bytes: okPng ? fs.statSync(png).size : 0,
      sha256: okPng ? sha256File(png) : null,
      controls: controls.slice(0, 12),
      reason: okPng ? null : 'screenshot pull failed',
    });
    console.log(`${theme} ${g.id} ${okPng ? (hasStart && hasBack ? 'intro OK' : 'INTRO-NOT-PROVEN') : 'FAIL'}`);
  }
}
// Restore the system default theme.
adb(['shell', 'cmd', 'uimode', 'night', 'auto']);

manifest.apkSha256 = apkHash;
manifest.apkPath = apkPath;
manifest.density = density;
manifest.screenSize = size;
for (const t of ['light', 'dark']) {
  const set = manifest.games.filter((g) => g.theme === t);
  manifest.themes.push({ theme: t, games: set.length, captured: set.filter((g) => g.captured).length, introProven: set.filter((g) => g.introSurface).length });
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ apk: apkHash, themes: manifest.themes }, null, 1));
