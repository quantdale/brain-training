#!/usr/bin/env node
/**
 * UI capture harness — native screenshot + hierarchy evidence for the frontend.
 *
 * Campaign 023 recorded "headless `screencap` returns a constant blank frame"
 * as an operational limitation. Root cause: the project's ATD AVDs ship
 * `hw.gpu.enabled=no`. On a GPU-enabled AVD real frames are returned, so this
 * harness turns "the UI looks better" into reproducible evidence:
 *
 *   - navigates by deep link (`<scheme>://<route>`) and by tapping tab items,
 *   - wakes the screen first (a sleeping device screenshots black),
 *   - writes `<out>/<profile>/<theme>/<surface>.png` plus the matching
 *     uiautomator dump, and a manifest describing device, app, build SHA and
 *     exactly which surfaces were captured or skipped and why.
 *
 * Everything is emulator-local: adb only, no host mouse/keyboard (constitution
 * §28 / AGENTS.md host-interaction prohibition).
 *
 * Usage:
 *   node scripts/qa/ui-capture.mjs --out qa-artifacts/campaign024/after
 *   node scripts/qa/ui-capture.mjs --surfaces home,games --theme dark
 *   node scripts/qa/ui-capture.mjs --list
 *
 * Always pass QA_DEVICE (or --device) on a host with more than one attached
 * device: resolving "first device" can select someone else's emulator.
 *
 * Exit codes: 0 all requested surfaces captured · 1 a surface failed ·
 * 2 BLOCKED (no usable device / app not installed).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');

/** Surfaces captured by default, in capture order.
 *
 * `expects` lists the root testIDs that prove the route actually arrived.
 * A dropped deep link under a cold bundle would otherwise file a valid-looking
 * Home frame as evidence for a different surface (campaign 028). */
const SURFACES = [
  { id: 'home', route: '/', settleMs: 2500, expects: ['home-title'] },
  { id: 'games', route: '/games', settleMs: 2000, expects: ['games-title'] },
  {
    id: 'game-detail',
    route: '/game-detail/memory',
    settleMs: 2500,
    expects: ['game-detail-title', 'game-detail-loading', 'game-detail-error'],
  },
  { id: 'progress', route: '/progress', settleMs: 2500, expects: ['progress-window-selector'] },
  {
    id: 'progress-activity',
    route: '/progress-activity',
    settleMs: 2000,
    expects: ['progress-activity-title', 'progress-activity-loading', 'progress-activity-error'],
  },
  {
    id: 'progress-detail',
    route: '/progress-detail',
    settleMs: 2000,
    expects: ['progress-detail-title', 'progress-detail-loading', 'progress-detail-error'],
  },
  { id: 'profile', route: '/profile', settleMs: 2500, expects: ['profile-identity'] },
  {
    id: 'rewards',
    route: '/rewards',
    settleMs: 2000,
    expects: ['rewards-title', 'rewards-loading', 'rewards-error'],
  },
  {
    id: 'data-management',
    route: '/data-management',
    settleMs: 2000,
    expects: ['data-management-title', 'data-loading'],
  },
  {
    id: 'results',
    route: '/results',
    settleMs: 2500,
    expects: ['results-title', 'results-loading', 'results-error'],
  },
  {
    id: 'game-intro',
    route: '/game/memory',
    settleMs: 3000,
    expects: ['memory.intro', 'memory.screen', 'game-not-ready-loading'],
  },
];

/**
 * Display profiles. `size`/`density` override the emulator's own resolution;
 * `fontScale` drives the Android system font scale so dynamic-type behaviour
 * can be inspected, and `orientation` rotates the activity.
 */
const PROFILES = {
  default: {},
  compact: { size: '720x1600', density: 320 },
  expanded: { size: '1600x2560', density: 320 },
  landscape: { size: '2400x1080', density: 420, orientation: 'landscape' },
  'font-scale-2': { fontScale: '2.0' },
};

function parseArgs(argv) {
  const options = {
    device: process.env.QA_DEVICE ?? null,
    out: 'qa-artifacts/ui-capture',
    surfaces: SURFACES.map((s) => s.id),
    profiles: ['default'],
    themes: ['light'],
    scheme: process.env.QA_SCHEME ?? 'braintraining',
    pkg: process.env.QA_PKG ?? 'com.braintraining.app',
    settleMs: Number(process.env.QA_CAPTURE_SETTLE_MS ?? 0),
    list: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--device') options.device = next();
    else if (arg === '--out') options.out = next();
    else if (arg === '--surfaces') options.surfaces = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--profile') options.profiles = [...options.profiles.filter((p) => p !== 'default'), next()];
    else if (arg === '--theme') options.themes = next().split(',').map((t) => t.trim()).filter(Boolean);
    else if (arg === '--scheme') options.scheme = next();
    else if (arg === '--pkg') options.pkg = next();
    else if (arg === '--settle-ms') options.settleMs = Number(next());
    else if (arg === '--list') options.list = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (options.list) options.profiles = ['default'];
  return options;
}

/** Pick the first adb device in `device` state when none was named. */
function resolveDevice(explicit) {
  const out = execFileSync('adb', ['devices'], { encoding: 'utf8' });
  const devices = out
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
  if (explicit) return devices.includes(explicit) ? explicit : null;
  return devices[0] ?? null;
}

function adb(device, args, options = {}) {
  return execFileSync('adb', ['-s', device, ...args], { encoding: options.binary ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Wake the device — a sleeping screen captures as solid black. */
function wake(device) {
  try {
    adb(device, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
    adb(device, ['shell', 'wm', 'dismiss-keyguard']);
  } catch {
    /* older images may not support dismiss-keyguard; the wake key is enough */
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/** Apply a display profile, returning the profile actually in effect. */
function applyProfile(device, name) {
  const profile = PROFILES[name];
  if (!profile) throw new Error(`Unknown profile: ${name}`);
  adb(device, ['shell', 'wm', 'reset']);
  if (profile.size) adb(device, ['shell', 'wm', 'size', profile.size]);
  if (profile.density) adb(device, ['shell', 'wm', 'density', String(profile.density)]);
  if (profile.fontScale) adb(device, ['shell', 'settings', 'put', 'system', 'font_scale', profile.fontScale]);
  adb(device, [
    'shell',
    'settings',
    'put',
    'system',
    'accelerometer_rotation',
    profile.orientation === 'landscape' ? '0' : '1',
  ]);
  if (profile.orientation) {
    adb(device, [
      'shell',
      'settings',
      'put',
      'system',
      'user_rotation',
      profile.orientation === 'landscape' ? '1' : '0',
    ]);
  }
  return profile;
}

/**
 * Restart the app so it starts fresh under the new display configuration.
 *
 * Changing `wm size`/`wm density` under a running activity restarts it while
 * the JS runtime keeps its already-initialised native handles; the app then
 * boots into its storage-error boundary (observed on the database module).
 * A cold start under the new profile is both realistic and deterministic, so
 * every profile switch is followed by a relaunch.
 */
function relaunchApp(device, pkg) {
  try {
    adb(device, ['shell', 'am', 'force-stop', pkg]);
  } catch {
    /* force-stop is best effort */
  }
  try {
    adb(device, ['shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1']);
  } catch {
    /* the deep link below still starts the activity */
  }
}

function resetProfile(device) {
  adb(device, ['shell', 'wm', 'reset']);
  adb(device, ['shell', 'settings', 'put', 'system', 'font_scale', '1.0']);
  adb(device, ['shell', 'settings', 'put', 'system', 'accelerometer_rotation', '1']);
}

/** Switch the OS night mode (the app's default theme follows the system). */
function applyTheme(device, theme) {
  if (theme !== 'light' && theme !== 'dark') throw new Error(`Unknown theme: ${theme}`);
  adb(device, ['shell', 'cmd', 'uimode', 'night', theme === 'dark' ? 'yes' : 'no']);
}

/** Deep-link a route; returns true when the activity started. */
function openRoute(device, scheme, route, pkg) {
  try {
    const out = adb(device, [
      'shell',
      'am',
      'start',
      '-W',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      `${scheme}://${route === '/' ? '' : route.replace(/^\//, '')}`,
      pkg,
    ]);
    return /Status: ok/.test(out);
  } catch {
    return false;
  }
}

function capturePng(device, path) {
  const buffer = adb(device, ['exec-out', 'screencap', '-p'], { binary: true });
  writeFileSync(path, buffer);
  return buffer.length;
}

function dumpHierarchy(device, path) {
  try {
    adb(device, ['shell', 'uiautomator', 'dump', '--compressed', '/sdcard/qa-capture.xml']);
    const xml = adb(device, ['shell', 'cat', '/sdcard/qa-capture.xml']);
    writeFileSync(path, xml);
    return xml.length;
  } catch {
    return 0;
  }
}

/** Presence report for the testIDs a surface is expected to expose. */
function testIdsPresent(xml, expected) {
  return expected.filter((id) => xml.includes(id));
}

function appBuildInfo(device, pkg) {
  try {
    const dump = adb(device, ['shell', 'dumpsys', 'package', pkg]);
    const version = /versionName=([^\s]+)/.exec(dump)?.[1] ?? 'unknown';
    const updated = /lastUpdateTime=([^\n]+)/.exec(dump)?.[1]?.trim() ?? 'unknown';
    return { version, lastUpdateTime: updated };
  } catch {
    return { version: 'unknown', lastUpdateTime: 'unknown' };
  }
}

/**
 * Wait until the app exposes a real, non-black frame.
 *
 * A freshly relaunched dev build spends several seconds on the Metro bundle
 * before any RN view exists, and a theme switch can leave the window black
 * for seconds after the tree mounts (Campaign 026 recapture). Both states
 * produced black screenshots filed as evidence, so batch start waits for a
 * mounted tree AND a non-uniform framebuffer.
 */
async function waitForWarm(device, timeoutMs = 90_000) {
  const started = Date.now();
  let sawTree = false;
  while (Date.now() - started < timeoutMs) {
    try {
      adb(device, ['shell', 'uiautomator', 'dump', '--compressed', '/sdcard/qa-warm.xml']);
      const xml = adb(device, ['shell', 'cat', '/sdcard/qa-warm.xml']);
      // Any text node means the RN tree mounted (the pre-JS root has none).
      if (/text="[^"]+"/.test(xml)) {
        sawTree = true;
        if (frameColorCount(device) > 2) {
          return true;
        }
      }
    } catch {
      /* the dump tool can fail while the activity restarts; retry */
    }
    await sleep(3000);
  }
  // Tree present but the frame never became visible: report it so the caller
  // does not silently file the batch as valid.
  return sawTree ? 'tree-only' : false;
}

/**
 * Count distinct sampled colours in a raw framebuffer capture. `screencap -p`
 * can return a valid PNG of a black window (the app surface is lost while the
 * activity re-renders), which the old size-based blank check missed; sampling
 * the raw pixels catches "the frame exists but is uniform".
 */
function frameColorCount(device) {
  const raw = adb(device, ['exec-out', 'screencap'], { binary: true });
  const unique = new Set();
  // Header is 12-16 bytes; stride ~one sample per 128x128 px block.
  for (let offset = 16; offset + 3 < raw.length; offset += 128 * 128 * 4) {
    unique.add(`${raw[offset]},${raw[offset + 1]},${raw[offset + 2]}`);
    if (unique.size > 4) {
      return unique.size;
    }
  }
  return unique.size;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    console.log('Surfaces (id — route — expected root testIDs):');
    for (const s of SURFACES) {
      console.log(`  ${s.id} — ${s.route} — ${(s.expects ?? []).join(', ') || '(none)'}`);
    }
    return;
  }
  const device = resolveDevice(options.device);
  if (!device) {
    console.error('[BLOCKED] no adb device in `device` state');
    process.exit(2);
  }

  let installed = '';
  try {
    installed = adb(device, ['shell', 'pm', 'list', 'packages', options.pkg]);
  } catch {
    installed = '';
  }
  if (!installed.includes(options.pkg)) {
    console.error(`[BLOCKED] ${options.pkg} is not installed on ${device}`);
    process.exit(2);
  }

  const outRoot = resolve(ROOT, options.out);
  const manifest = {
    capturedAt: new Date().toISOString(),
    device,
    package: options.pkg,
    build: appBuildInfo(device, options.pkg),
    scheme: options.scheme,
    profiles: options.profiles,
    themes: options.themes,
    surfaces: [],
    skipped: [],
  };

  wake(device);
  for (const theme of options.themes) {
    applyTheme(device, theme);
    for (const profileName of options.profiles) {
      applyProfile(device, profileName);
      relaunchApp(device, options.pkg);
      await sleep(4000);
      const warmed = await waitForWarm(device);
      if (!warmed) {
        console.error(`[WARN] app did not warm within 90s for ${profileName}/${theme}`);
      } else if (warmed === 'tree-only') {
        console.error(`[WARN] app tree mounted but frame stayed black for ${profileName}/${theme}`);
      }
      for (const surfaceId of options.surfaces) {
        const surface = SURFACES.find((s) => s.id === surfaceId);
        if (!surface) {
          manifest.skipped.push({ surface: surfaceId, reason: 'unknown surface id' });
          continue;
        }
        const dir = join(outRoot, profileName, theme);
        mkdirSync(dir, { recursive: true });
        const pngPath = join(dir, `${surface.id}.png`);
        const xmlPath = join(dir, `${surface.id}.xml`);

        const opened = openRoute(device, options.scheme, surface.route, options.pkg);
        await sleep(surface.settleMs + options.settleMs);
        wake(device);
        await sleep(400);

        // A theme switch or a cold route can leave the app surface black for a
        // few seconds after the hierarchy looks warm; retry the frame instead
        // of filing a black screenshot as evidence (Campaign 026 recapture).
        // Campaign 028 adds arrival verification: if the deep link was dropped
        // (cold-bundle `onNewIntent` gap), the frame belongs to another route;
        // retry once from a cold start so the URL becomes the initial intent,
        // and record honestly when the surface never arrived.
        let bytes = 0;
        let xmlBytes = 0;
        let xml = '';
        let uniform = false;
        let routeVerified = true;
        let reopenedCold = false;
        const markers = surface.expects ?? [];
        for (let attempt = 0; attempt < 3; attempt += 1) {
          bytes = capturePng(device, pngPath);
          xmlBytes = dumpHierarchy(device, xmlPath);
          xml = xmlBytes > 0 ? readFileSync(xmlPath, 'utf8') : '';
          uniform = frameColorCount(device) <= 2;
          if (uniform) {
            await sleep(4000);
            continue;
          }
          // A missing hierarchy dump is a dump failure, not route evidence:
          // only judge arrival when the dump actually produced a tree.
          routeVerified =
            markers.length === 0 || xmlBytes === 0 || markers.some((m) => xml.includes(m));
          if (routeVerified || attempt === 2) {
            break;
          }
          if (!reopenedCold) {
            // Cold-start retry: force-stop first so the URL is delivered as
            // the initial intent rather than a droppable onNewIntent.
            try {
              adb(device, ['shell', 'am', 'force-stop', options.pkg]);
            } catch {
              /* best effort */
            }
            openRoute(device, options.scheme, surface.route, options.pkg);
            reopenedCold = true;
          }
          await sleep(surface.settleMs + options.settleMs);
          wake(device);
          await sleep(600);
        }
        const testIds = testIdsPresent(xml, ['home-title', 'tab-home', 'games-title', 'progress-window-selector', 'profile-identity']);

        // A uniform screen is the failure mode this harness exists to detect:
        // a blank frame, a lost app surface, or the storage-error boundary all
        // mean "this evidence is invalid", never "this looks fine".
        const renderedErrorBoundary = /Storage Unavailable/.test(xml);
        const blank = uniform || renderedErrorBoundary || (bytes < 40_000 && xmlBytes === 0);
        const entry = {
          surface: surface.id,
          route: surface.route,
          profile: profileName,
          theme,
          png: pngPath.replace(ROOT, '').replace(/\\/g, '/'),
          xml: xmlBytes > 0 ? xmlPath.replace(ROOT, '').replace(/\\/g, '/') : null,
          pngBytes: bytes,
          xmlBytes,
          deepLinkStarted: opened,
          routeVerified,
          ...(routeVerified ? null : { routeMismatch: true, routeRetriedCold: reopenedCold }),
          testIdsPresent: testIds,
          blank,
          ...(uniform ? { blankReason: 'uniform-frame' } : null),
          ...(renderedErrorBoundary ? { blankReason: 'storage-error-boundary' } : null),
        };
        manifest.surfaces.push(entry);
        console.log(
          `${blank ? 'BLANK ' : !routeVerified ? 'WRONG ' : 'ok    '} ${profileName}/${theme}/${surface.id} (${bytes} B, ${xmlBytes} B xml)`,
        );
      }
    }
  }

  resetProfile(device);
  const manifestPath = join(outRoot, 'manifest.json');
  mkdirSync(outRoot, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nManifest: ${manifestPath}`);

  const blanks = manifest.surfaces.filter((s) => s.blank);
  const mismatched = manifest.surfaces.filter((s) => s.routeMismatch);
  if (blanks.length > 0 || mismatched.length > 0) {
    if (blanks.length > 0) {
      console.error(`[FAIL] ${blanks.length} blank capture(s): ${blanks.map((b) => b.surface).join(', ')}`);
    }
    if (mismatched.length > 0) {
      console.error(
        `[FAIL] ${mismatched.length} surface(s) never arrived (dropped deep link): ${mismatched.map((m) => m.surface).join(', ')}`,
      );
    }
    process.exit(1);
  }
  console.log(`[PASS] ${manifest.surfaces.length} surface capture(s)`);
}

await main();
