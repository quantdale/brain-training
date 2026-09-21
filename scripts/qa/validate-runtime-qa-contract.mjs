#!/usr/bin/env node
/**
 * Offline contract check for the Android runtime-QA boundary.
 *
 * ARTEMIS is installed outside this repository, so CI cannot (and must not)
 * require a device, model credential, or network service. This check guards
 * the repository-side handoff: the former custom driver is absent, the
 * authoritative setup documentation names the external ARTEMIS location and
 * MCP surface, and the app's semantic/deep-link seams remain available to the
 * runtime agent.
 *
 * Structure, not substrings: the Expo scheme is asserted from parsed JSON and
 * every documented `braintraining://` deep link is resolved against the real
 * router tree. The resolution logic is pure and fixture-testable via
 * `--self-test`, so it needs neither a device nor repository state.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function absolute(relative) {
  return path.join(ROOT, relative);
}

function read(relative) {
  return fs.readFileSync(absolute(relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(absolute(relative));
}

const failures = [];

function requireFile(relative) {
  if (!exists(relative)) failures.push(`missing required file: ${relative}`);
}

function requireText(relative, needle) {
  if (!exists(relative)) {
    failures.push(`cannot inspect missing file: ${relative}`);
    return;
  }
  if (!read(relative).includes(needle)) {
    failures.push(`missing '${needle}' in ${relative}`);
  }
}

const SCHEME_PREFIX = 'braintraining://';
const PLACEHOLDER_RE = /[<>]/;
const SELF_TEST = process.argv.includes('--self-test');

/**
 * Extract every `braintraining://<path>` occurrence from documentation text.
 * Handles backtick-quoted and bare forms and drops trailing punctuation such
 * as `.`, `,`, `;`, `:`, `!`, `?`, `)` or `"` that prose wraps around a link.
 *
 * Pure: depends only on the supplied text.
 */
function extractDeepLinks(text) {
  const links = [];
  const re = new RegExp(`${SCHEME_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\s\`'"\\])}\\],;:!?]+)`, 'g');
  for (const match of text.matchAll(re)) {
    const raw = match[1];
    const trimmed = raw.replace(/[.,;:!?)\]"']+$/, '');
    if (trimmed.length === 0) continue;
    const link = `${SCHEME_PREFIX}${trimmed}`;
    if (!links.includes(link)) links.push(link);
  }
  return links;
}

/**
 * Build a route index from an Expo Router `app/` directory. Each route file
 * maps to its slash-joined segments with the extension removed, e.g.
 * `game/[id].tsx` → `game/[id]`.
 *
 * Pure over the supplied directory: no globals beyond the filesystem.
 */
function buildRouteIndex(appDir) {
  const index = new Map();
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        walk(full, [...prefix, entry.name]);
        continue;
      }
      const match = /^(.+)\.(tsx|ts|jsx|js)$/.exec(entry.name);
      if (!match) continue;
      index.set([...prefix, match[1]].join('/'), full);
    }
  };
  walk(appDir, []);
  return index;
}

/**
 * Resolve a documented deep-link path against a route index produced by
 * `buildRouteIndex`. Pure: `(linkPath, routeIndex)` in, verdict out.
 *
 * Resolution order:
 *   - paths with a file extension already match that exact route;
 *   - exact `foo/bar`, `foo/bar.ts`, and `foo/bar/index.tsx` candidates;
 *   - a placeholder segment (`<id>`) must match a real dynamic route of the
 *     same depth (`game/<id>` → `game/[id]`); a placeholder never resolves on
 *     its own, so the check cannot go vacuous;
 *   - a path whose first segment is a directory owning a `[param].tsx`
 *     dynamic route also resolves, since the param accepts any id.
 */
function resolveDeepLink(linkPath, routeIndex) {
  const raw = linkPath.startsWith(SCHEME_PREFIX)
    ? linkPath.slice(SCHEME_PREFIX.length)
    : linkPath;
  const normalized = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  if (normalized.length === 0) {
    return { resolved: false, reason: 'empty' };
  }
  if (PLACEHOLDER_RE.test(normalized)) {
    const pattern = normalized.split('/');
    const match = [...routeIndex.keys()].find((route) => {
      const routeSegments = route.split('/');
      return (
        routeSegments.length === pattern.length &&
        pattern.every((segment, index) =>
          PLACEHOLDER_RE.test(segment)
            ? /^\[.+\]$/.test(routeSegments[index])
            : routeSegments[index] === segment,
        )
      );
    });
    return match
      ? { resolved: true, reason: 'placeholder', route: match }
      : { resolved: false, reason: 'missing' };
  }

  if (/\.(tsx|ts|jsx|js)$/.test(normalized)) {
    return routeIndex.has(normalized)
      ? { resolved: true, reason: 'exact' }
      : { resolved: false, reason: 'missing' };
  }

  if (routeIndex.has(normalized)) return { resolved: true, reason: 'exact' };
  if (routeIndex.has(`${normalized}/index`)) {
    return { resolved: true, reason: 'index' };
  }

  const segments = normalized.split('/');
  const head = segments[0];
  const dynamic = [...routeIndex.keys()].find((route) => {
    const routeSegments = route.split('/');
    return (
      routeSegments.length === segments.length &&
      routeSegments[0] === head &&
      /^\[.+\]$/.test(routeSegments[1] ?? '')
    );
  });
  if (dynamic) return { resolved: true, reason: 'dynamic', route: dynamic };

  return { resolved: false, reason: 'missing' };
}

function appSchemeFailure() {
  const relative = 'apps/mobile/app.json';
  if (!exists(relative)) {
    return `cannot inspect missing file: ${relative}`;
  }
  let manifest;
  try {
    manifest = JSON.parse(read(relative));
  } catch (error) {
    return `unparseable JSON in ${relative}: ${error.message}`;
  }
  if (manifest?.expo?.scheme !== 'braintraining') {
    const actual = JSON.stringify(manifest?.expo?.scheme);
    return `expo.scheme is ${actual ?? 'undefined'} in ${relative}, expected "braintraining"`;
  }
  return null;
}

function testIdSeamFailure() {
  const relative = 'apps/mobile/src/sdk/testid.ts';
  if (!exists(relative)) return `missing required file: ${relative}`;
  const source = read(relative);
  if (!/export\s+(?:async\s+)?(?:function|const)\s+(?:testID|testId|makeTestID|makeTestId)\b/.test(source)) {
    return `no exported testID helper found in ${relative}`;
  }
  return null;
}

function deepLinkFailures(routeIndex) {
  const relative = 'docs/ARTEMIS_ANDROID_QA.md';
  if (!exists(relative)) return [`cannot inspect missing file: ${relative}`];
  const links = extractDeepLinks(read(relative));
  const problems = [];
  for (const link of links) {
    const verdict = resolveDeepLink(link, routeIndex);
    if (!verdict.resolved) {
      problems.push(`missing route for documented deep link: ${link}`);
    }
  }
  return problems;
}

/**
 * Offline self-test: exercises the pure resolver and link extraction with
 * fixtures only. No device, no repository filesystem state.
 */
function runSelfTest() {
  const routeIndex = new Map([
    ['(tabs)', 'fixture/(tabs)/_layout.tsx'],
    ['(tabs)/games', 'fixture/(tabs)/games.tsx'],
    ['(tabs)/index', 'fixture/(tabs)/index.tsx'],
    ['game/[id]', 'fixture/game/[id].tsx'],
    ['results', 'fixture/results.tsx'],
    ['progress-detail', 'fixture/progress-detail.tsx'],
  ]);

  const checks = [];
  const check = (name, ok) => checks.push({ name, ok });

  check(
    'existing static route resolves',
    resolveDeepLink('progress-detail', routeIndex).resolved === true,
  );
  check(
    'nested route resolves',
    resolveDeepLink('(tabs)/games', routeIndex).resolved === true,
  );
  check(
    'nested index route resolves',
    resolveDeepLink('(tabs)', routeIndex).resolved === true,
  );
  check(
    'dynamic-route id resolves',
    resolveDeepLink('game/memory', routeIndex).resolved === true,
  );
  check(
    'dynamic-route id is reported as dynamic',
    resolveDeepLink('game/memory', routeIndex).reason === 'dynamic',
  );
  check(
    'unknown route fails',
    resolveDeepLink('game/whatever/else', routeIndex).resolved === false,
  );
  check(
    'missing route fails',
    resolveDeepLink('not-a-route', routeIndex).resolved === false,
  );
  check(
    'placeholder resolves against a real dynamic route',
    resolveDeepLink('game/<id>', routeIndex).resolved === true &&
      resolveDeepLink('game/<id>', routeIndex).route === 'game/[id]',
  );
  check(
    'placeholder is reported as intentionally dynamic',
    resolveDeepLink('game/<id>', routeIndex).reason === 'placeholder',
  );
  check(
    'placeholder without a matching dynamic route fails',
    resolveDeepLink('unknown/<id>', routeIndex).resolved === false,
  );
  check('empty path fails', resolveDeepLink('/', routeIndex).resolved === false);
  check(
    'normalization strips slashes and scheme',
    resolveDeepLink('braintraining:///game/memory/', routeIndex).resolved === true,
  );

  const prose = [
    'Use a `braintraining://game/<id>` deep link,',
    'or the concrete `braintraining://game/memory` link.',
    'A bare braintraining://results path works too;',
    'the old braintraining://home route is unsupported.',
  ].join(' ');
  const extracted = extractDeepLinks(prose);
  check('extraction finds backtick links', extracted.includes('braintraining://game/memory'));
  check('extraction finds bare links', extracted.includes('braintraining://results'));
  check('extraction trims trailing punctuation', !extracted.some((link) => link.endsWith('.')));
  check('extraction keeps placeholders', extracted.includes('braintraining://game/<id>'));

  const failures = checks.filter((entry) => !entry.ok);
  if (failures.length > 0) {
    console.error('Runtime QA contract self-test: FAIL');
    for (const entry of failures) console.error(`- ${entry.name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Runtime QA contract self-test: PASS (${checks.length} checks)`);
}

if (SELF_TEST) {
  runSelfTest();
} else {
  // The custom orchestrator was intentionally removed. Historical campaign
  // records may still mention its name, but no executable or lockfile may remain.
  if (exists('scripts/qa/autobot.mjs')) {
    failures.push('obsolete custom QA driver still exists: scripts/qa/autobot.mjs');
  }
  if (read('.gitignore').includes('scripts/qa/.autobot.lock')) {
    failures.push('obsolete custom QA lock is still ignored: scripts/qa/.autobot.lock');
  }

  [
    'docs/ARTEMIS_ANDROID_QA.md',
    'docs/ANDROID_AUTOMATION.md',
    'scripts/qa/README.md',
    'scripts/qa/validate-runtime-qa-contract.mjs',
  ].forEach(requireFile);

  requireText('docs/ARTEMIS_ANDROID_QA.md', 'D:\\Tools\\artemis');
  requireText('docs/ARTEMIS_ANDROID_QA.md', 'mobile_run_task');
  requireText('docs/ARTEMIS_ANDROID_QA.md', 'mobile_diagnose');
  requireText('docs/ARTEMIS_ANDROID_QA.md', '--profile flash');
  requireText('docs/ARTEMIS_ANDROID_QA.md', '--profile pro');
  requireText('docs/ARTEMIS_ANDROID_QA.md', 'braintraining-ui35');
  requireText('AGENTS.md', 'ARTEMIS');
  requireText('README.md', 'ARTEMIS');

  // Product instrumentation seams required for resilient natural-language QA.
  const schemeFailure = appSchemeFailure();
  if (schemeFailure) failures.push(schemeFailure);

  const testIdFailure = testIdSeamFailure();
  if (testIdFailure) failures.push(testIdFailure);

  const routeIndex = exists('apps/mobile/src/app')
    ? buildRouteIndex(absolute('apps/mobile/src/app'))
    : new Map();
  if (routeIndex.size === 0) {
    failures.push('missing router tree: apps/mobile/src/app');
  } else {
    failures.push(...deepLinkFailures(routeIndex));
  }

  if (failures.length > 0) {
    console.error('Runtime QA contract: FAIL');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Runtime QA contract: PASS');
  }
}
