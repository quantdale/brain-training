#!/usr/bin/env node
/**
 * Accessibility audit over captured uiautomator dumps.
 *
 * `ui-capture.mjs` writes a hierarchy dump next to every screenshot. This tool
 * turns those dumps into measurements the campaign can be judged against:
 *
 *   - interactive nodes smaller than the 44×44 dp contract
 *     (px bounds converted with the capture density),
 *   - interactive nodes with no accessible name (no text, no content-desc),
 *   - non-interactive ImageViews / Views that are exposed to assistive tech
 *     without a label (decorative art should be hidden from the a11y tree),
 *   - a per-surface summary of roles present.
 *
 * Clipping/occlusion rule (Campaign 026, revised Campaign 067 hardening):
 * uiautomator reports the VISIBLE bounds of a node, so a control scrolled under
 * the bottom tab bar (or past the screen edge) measures shorter than it lays
 * out (a 44 dp button measured 16 dp when 28 dp of it sat behind the bar). A
 * partially visible row is unmeasurable, not undersized; those nodes are
 * counted as `occluded` (with the reason: the tab-bar overlay or the screen
 * edge) and excluded from the violation list, and each is reported with its
 * visible size so the exclusion stays visible. The visible viewport falls back
 * to the dump's screen extent when no scroll container is inset, so stack
 * routes without a tab bar are measured against the screen edge instead of
 * being re-classified as undersized.
 *
 * Usage:
 *   node scripts/qa/a11y-audit.mjs --dir qa-artifacts/campaign024/after
 *   node scripts/qa/a11y-audit.mjs --dir <dir> --density 420 --json
 *
 * Exit codes: 0 no violation · 1 violations found · 2 BLOCKED (no dumps).
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MIN_TARGET_DP = 44;

function parseArgs(argv) {
  const options = { dir: 'qa-artifacts/ui-capture', density: 420, json: false, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--dir') options.dir = next();
    else if (arg === '--density') options.density = Number(next());
    else if (arg === '--out') options.out = next();
    else if (arg === '--json') options.json = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

/** Every `.xml` dump under a directory tree (recursive). */
function collectDumps(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collectDumps(full));
    else if (entry.endsWith('.xml')) found.push(full);
  }
  return found;
}

/** `[x1,y1][x2,y2]` → width/height in pixels. */
function boundsSize(bounds) {
  const match = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(bounds ?? '');
  if (!match) return null;
  const [, x1, y1, x2, y2] = match.map(Number);
  return { width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

/**
 * Screen extent (px) from the dump: the furthest bottom edge across every
 * node. uiautomator clips node bounds to the visible window, so the root
 * frame's bottom is the screen height.
 */
function screenBottom(parsed) {
  let bottom = 0;
  for (const node of parsed) {
    const value = boundsBottom(node.bounds);
    if (value !== null) bottom = Math.max(bottom, value);
  }
  return bottom;
}

/**
 * Visible content viewport (px) for a surface: the deepest scroll container
 * that ends above the screen bottom (the bottom tab bar clips it). When every
 * scroll container spans the full screen — a stack route with no tab bar — the
 * viewport is the screen bottom, so a node scrolled past the screen edge is
 * still classified as occluded instead of re-measured as short.
 *
 * Returns `{ bottom, reason }`: `tab-bar-overlay` when a tab-bar inset was
 * found, `screen-edge` when the screen extent itself is the limit.
 */
function visibleViewport(parsed) {
  const screen = screenBottom(parsed);
  const bottoms = [];
  for (const node of parsed) {
    if (!/ScrollView/.test(node.className)) continue;
    const bottom = boundsBottom(node.bounds);
    if (bottom !== null && bottom < screen) bottoms.push(bottom);
  }
  if (bottoms.length > 0) return { bottom: Math.max(...bottoms), reason: 'tab-bar-overlay' };
  return { bottom: screen, reason: 'screen-edge' };
}

/** Top edge (px) of a node's bounds. */
function boundsTop(bounds) {
  const match = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(bounds ?? '');
  return match ? Number(match[2]) : null;
}

/** Bottom edge (px) of a node's bounds. */
function boundsBottom(bounds) {
  const match = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(bounds ?? '');
  return match ? Number(match[4]) : null;
}

/** Minimal attribute reader for uiautomator's flat `<node …>` elements. */
function nodes(xml) {
  const out = [];
  for (const tag of xml.match(/<node\b[^>]*>/g) ?? []) {
    const attr = (name) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
    out.push({
      className: attr('class'),
      text: attr('text'),
      contentDesc: attr('content-desc'),
      resourceId: attr('resource-id'),
      clickable: attr('clickable') === 'true',
      longClickable: attr('long-clickable') === 'true',
      checkable: attr('checkable') === 'true',
      scrollable: attr('scrollable') === 'true',
      bounds: attr('bounds'),
    });
  }
  return out;
}

/** Interactive = anything a user can activate. */
function isInteractive(node) {
  return node.clickable || node.longClickable || node.checkable;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd(), options.dir);
  let dumps;
  try {
    dumps = collectDumps(root);
  } catch {
    console.error(`[BLOCKED] no dump directory at ${root}`);
    process.exit(2);
  }
  if (dumps.length === 0) {
    console.error(`[BLOCKED] no .xml hierarchy dumps under ${root}`);
    process.exit(2);
  }

  const scale = options.density / 160;
  const report = { dir: root, density: options.density, surfaces: [], violations: [], occluded: [] };

  for (const dump of dumps) {
    const surface = dump.slice(root.length + 1).replace(/\\/g, '/').replace(/\.xml$/, '');
    const parsed = nodes(readFileSync(dump, 'utf8'));
    const interactive = parsed.filter(isInteractive);
    const labelled = interactive.filter((n) => n.contentDesc.length > 0 || n.text.length > 0);
    const undersized = [];
    const unlabelled = [];
    const occluded = [];
    const viewport = visibleViewport(parsed);

    for (const node of interactive) {
      const size = boundsSize(node.bounds);
      if (!size) continue;
      const bottom = boundsBottom(node.bounds);
      const top = boundsTop(node.bounds);
      // A node that starts INSIDE the visible viewport but whose bottom pins to
      // its edge is partially scrolled out of view; its visible bounds are not
      // its laid-out size. Nodes below the viewport (the tab bar itself) are
      // fully visible and excluded by the `top` condition.
      if (
        top !== null &&
        bottom !== null &&
        top < viewport.bottom - 1 &&
        bottom >= viewport.bottom - 1
      ) {
        occluded.push({
          label: node.contentDesc || node.text || node.resourceId || node.className,
          heightDp: Math.round(size.height / scale),
          reason: viewport.reason,
        });
        continue;
      }
      const widthDp = size.width / scale;
      const heightDp = size.height / scale;
      if (widthDp + 0.5 < MIN_TARGET_DP || heightDp + 0.5 < MIN_TARGET_DP) {
        undersized.push({
          label: node.contentDesc || node.text || node.resourceId || node.className,
          widthDp: Math.round(widthDp),
          heightDp: Math.round(heightDp),
        });
      }
      if (node.contentDesc.length === 0 && node.text.length === 0) {
        unlabelled.push({ className: node.className, bounds: node.bounds });
      }
    }

    const entry = {
      surface,
      interactive: interactive.length,
      labelled: labelled.length,
      undersized,
      unlabelled,
      occluded,
    };
    report.surfaces.push(entry);
    for (const violation of undersized) {
      report.violations.push({ surface, kind: 'target<44dp', ...violation });
    }
    for (const violation of unlabelled) {
      report.violations.push({ surface, kind: 'unlabelled-interactive', ...violation });
    }
    for (const node of occluded) {
      report.occluded.push({ surface, kind: 'occluded', ...node });
    }
  }

  if (options.out) {
    writeFileSync(resolve(process.cwd(), options.out), `${JSON.stringify(report, null, 2)}\n`);
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const surface of report.surfaces) {
      const status = surface.undersized.length === 0 && surface.unlabelled.length === 0 ? 'ok   ' : 'ISSUE';
      console.log(
        `${status} ${surface.surface.padEnd(38)} interactive=${surface.interactive} labelled=${surface.labelled} ` +
          `undersized=${surface.undersized.length} unlabelled=${surface.unlabelled.length} ` +
          `occluded=${surface.occluded.length}`,
      );
      for (const node of surface.undersized.slice(0, 5)) {
        console.log(`        <44dp: ${node.label} (${node.widthDp}x${node.heightDp} dp)`);
      }
      for (const node of surface.unlabelled.slice(0, 5)) {
        console.log(`        unlabelled: ${node.className} ${node.bounds}`);
      }
      for (const node of surface.occluded.slice(0, 5)) {
        console.log(
          `        occluded (${node.reason}, unmeasured; partially past the visible viewport): ${node.label} (visible ${node.heightDp} dp)`,
        );
      }
    }
  }

  console.log(
    `\n${report.violations.length === 0 ? '[PASS]' : '[FAIL]'} ${report.violations.length} violation(s) across ${report.surfaces.length} surface(s)`,
  );
  console.log(
    `${report.occluded.length} occluded node(s) excluded as unmeasurable (not size violations)`,
  );
  process.exit(report.violations.length === 0 ? 0 : 1);
}

main();
