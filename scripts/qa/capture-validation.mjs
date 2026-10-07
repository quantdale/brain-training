/** Pure certification checks shared by the device capture harness and tests. */
import { createRequire } from 'node:module';

// QA-only dependency installed alongside the app; examine the PNG actually
// filed as evidence, not a second framebuffer sample taken after rendering.
const { PNG } = createRequire(new URL('../../apps/mobile/package.json', import.meta.url))('pngjs');

/** Inspect the actual PNG, not a later framebuffer with different pixels. */
export function inspectPng(buffer) {
  const { width, height, data } = PNG.sync.read(buffer);
  if (width < 100 || height < 100) return { colors: 0, statusBarDiscontinuity: true };
  const middle = Math.floor(width / 2);
  const belowStatus = Math.floor(height * 0.05);
  const topOffset = middle * 4;
  const belowOffset = (belowStatus * width + middle) * 4;
  // The product sets the system bar to the screen background in both themes.
  // A black strip with clipped status icons above a light app is a transient
  // compositor failure, not a valid screenshot of the route.
  const statusBarDiscontinuity = [0, 1, 2].reduce(
    (delta, channel) => delta + Math.abs(data[topOffset + channel] - data[belowOffset + channel]), 0,
  ) > 240;
  const unique = new Set();
  for (let y = Math.floor(height * 0.12); y < height * 0.88; y += Math.max(1, Math.floor(height / 50))) {
    for (let x = Math.floor(width * 0.05); x < width * 0.95; x += Math.max(1, Math.floor(width / 40))) {
      const offset = (y * width + x) * 4;
      unique.add(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
      if (unique.size > 4) return { colors: unique.size, statusBarDiscontinuity };
    }
  }
  return { colors: unique.size, statusBarDiscontinuity };
}

/** Distinct sampled colors in the app content, excluding status/nav chrome. */
export const contentColorCount = (buffer) => inspectPng(buffer).colors;

export const captureKey = ({ profile, theme, surface }) => `${profile}/${theme}/${surface}`;

/** A screenshot cannot certify arrival without an app-owned hierarchy and a route marker. */
export function routeArrived(xml, pkg, markers, requireAll = false) {
  const firstNodePackage = /<node\b[^>]*\bpackage="([^"]+)"/.exec(xml)?.[1];
  if (!firstNodePackage || firstNodePackage !== pkg || markers.length === 0) return false;
  const hasId = (id) => xml.includes(`resource-id="${id}"`);
  return requireAll ? markers.every(hasId) : markers.some(hasId);
}

/** A requested matrix is complete only when EVERY unique key has valid content. */
export function captureIssues(manifest) {
  if (!Array.isArray(manifest.profiles) || !Array.isArray(manifest.themes) ||
      !Array.isArray(manifest.requestedSurfaces) || !Array.isArray(manifest.surfaces) ||
      !Array.isArray(manifest.skipped) || !manifest.profiles.length ||
      !manifest.themes.length || !manifest.requestedSurfaces.length) {
    return ['missing or empty requested matrix declaration'];
  }
  const requested = [];
  for (const profile of manifest.profiles) {
    for (const theme of manifest.themes) {
      for (const surface of manifest.requestedSurfaces) {
        requested.push(captureKey({ profile, theme, surface }));
      }
    }
  }
  const expected = new Set(requested);
  const issues = [];
  if (manifest.aborted) issues.push(`capture aborted: ${manifest.aborted}`);
  if (expected.size !== requested.length) issues.push('duplicate requested matrix key');
  const seen = new Set();
  for (const entry of manifest.surfaces) {
    const key = captureKey(entry);
    if (!expected.has(key)) issues.push(`unexpected capture: ${key}`);
    if (seen.has(key)) issues.push(`duplicate capture: ${key}`);
    seen.add(key);
    if (!entry.routeVerified || entry.blank || !entry.foregroundVerified ||
        !entry.pngBytes || !entry.xmlBytes || !entry.pngSha256 || !entry.xmlSha256) {
      issues.push(`invalid screenshot or hierarchy: ${key}`);
    }
  }
  for (const key of expected) {
    if (!seen.has(key)) issues.push(`missing capture: ${key}`);
  }
  for (const skipped of manifest.skipped) issues.push(`skipped: ${captureKey(skipped)} (${skipped.reason})`);
  return issues;
}
