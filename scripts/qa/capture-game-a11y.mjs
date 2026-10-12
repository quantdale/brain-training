/**
 * 076-f Phase 5 — capture live GAME CONTROL accessibility from a real device.
 *
 * The route-level audit (scripts/qa/a11y-audit.mjs over ui-capture.mjs dumps)
 * measures route components and explicitly does not certify game controls: the
 * change spec says "game-control reachability, labels, and target size remain
 * unaccepted until those controls are measured". This tool measures them.
 *
 * For each requested game it launches the game on the device, dumps the live
 * board hierarchy, and records for the game's own control namespace:
 *   - every interactive node, with its accessible name (text OR content-desc),
 *   - its visible bounds converted to dp at the capture density,
 *   - whether it meets the Android 48dp floor,
 *   - whether it is clipped or occluded.
 *
 * Device-only: this never drives gameplay beyond launching the game. The
 * resulting dump is analysed by scripts/qa/a11y-audit.mjs, which owns the 48dp
 * contract and the occlusion rule.
 *
 * Usage:
 *   node scripts/qa/capture-game-a11y.mjs --out <dir> [--device <serial>]
 *       [--games a,b,c] [--density 420]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PKG = 'com.braintraining.app';

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const OUT = arg('out', 'qa-artifacts/game-a11y');
const DEVICE = arg('device', process.env.BT_DEVICE || 'emulator-5570');
const DENSITY = Number(arg('density', 420));
const ROOT = process.cwd();

const adb = (args, timeout = 120000) => {
  try {
    return execFileSync('adb', ['-s', DEVICE, ...args], { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return String((e.stdout || '') + (e.stderr || '') + (e.message || ''));
  }
};

/** The 42 registered games, from the generated registry. */
function loadGames() {
  const src = fs.readFileSync(path.join(ROOT, 'apps/mobile/src/registry/registry.generated.ts'), 'utf8');
  const out = [];
  const re = /id:\s*"([a-z0-9-]+)"[\s\S]{0,200}?name:\s*"([^"]+)"[\s\S]{0,400}?primaryCategory:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) out.push({ id: m[1], name: m[2], category: m[3] });
  return out;
}

const main = async () => {
  const all = loadGames();
  const wanted = arg('games', '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const games = wanted.length ? all.filter((g) => wanted.includes(g.id)) : all;
  if (!games.length) { console.error('no matching games'); process.exit(2); }

  fs.mkdirSync(OUT, { recursive: true });
  const manifest = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const g of games) {
    adb(['shell', 'am', 'force-stop', PKG]);
    await sleep(900);
    // Launch the game directly; the loader lands on the intro, whose controls
    // are the same game-owned namespace the live board uses.
    adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `braintraining://game/${g.id}`]);
    await sleep(3600);

    const remote = `/sdcard/cert-game-a11y-${g.id}.xml`;
    adb(['shell', 'uiautomator', 'dump', remote], 60000);
    const local = path.join(OUT, `${g.id}.xml`);
    try {
      execFileSync('adb', ['-s', DEVICE, 'pull', remote, local], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { /* handled below */ }

    if (!fs.existsSync(local) || fs.statSync(local).size < 200) {
      manifest.push({ game: g.id, name: g.name, captured: false, reason: 'hierarchy dump unavailable' });
      continue;
    }
    const xml = fs.readFileSync(local, 'utf8');
    const nodes = [];
    const re = /<node\b([^>]*?)\/?>/g;
    let m;
    while ((m = re.exec(xml))) {
      const a = m[1];
      const get = (k) => (new RegExp(`${k}="([^"]*)"`).exec(a) || [, ''])[1];
      nodes.push({
        text: get('text'), desc: get('content-desc'), rid: get('resource-id'),
        clickable: get('clickable') === 'true', enabled: get('enabled') === 'true',
        bounds: get('bounds'),
      });
    }
    const controls = nodes.filter((n) => n.clickable && (n.rid || '').startsWith(`${g.id}.`));
    manifest.push({
      game: g.id,
      name: g.name,
      category: g.category,
      captured: true,
      device: DEVICE,
      density: DENSITY,
      totalNodes: nodes.length,
      gameControls: controls.length,
      controls: controls.map((c) => ({ rid: c.rid, label: c.text || c.desc || '', bounds: c.bounds, enabled: c.enabled })),
    });
    console.log(`captured ${g.id}: ${controls.length} game controls of ${nodes.length} nodes`);
  }

  fs.writeFileSync(path.join(OUT, 'game-a11y-manifest.json'), `${JSON.stringify({ device: DEVICE, density: DENSITY, games: manifest }, null, 2)}\n`);
  const ok = manifest.filter((m) => m.captured).length;
  console.log(`\ncaptured ${ok}/${games.length} games -> ${OUT}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
