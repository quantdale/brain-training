#!/usr/bin/env node
/**
 * W13 performance baseline probe runner (campaign 009; extended campaign 012).
 *
 * Executes the opt-in measurement specs under jest with PERF_PROBE=1, captures
 * each spec's `PERF_*_JSON:` report line, and writes timestamped JSON baselines
 * into scripts/perf/baselines/:
 *
 * - apps/mobile/src/__tests__/perf-baseline-probe.test.ts   → PERF_BASELINE_JSON
 * - apps/mobile/src/__tests__/perf-sync-scan-probe.test.ts → PERF_SYNC_JSON
 *
 * Usage (from repo root):
 *   node scripts/perf/run-probes.mjs
 *
 * The probes are measurements, not gates — absolute numbers vary by machine.
 * Compare two baselines from the SAME machine to evaluate a change.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const mobileDir = path.join(repoRoot, 'apps', 'mobile');
const baselinesDir = path.join(scriptDir, 'baselines');

/** Spec files + the JSON marker line each prints. Order: cheap→expensive. */
const PROBES = [
  {
    spec: 'src/__tests__/perf-baseline-probe.test.ts',
    marker: 'PERF_BASELINE_JSON:',
    prefix: 'perf-baseline',
    note: 'history-read costs (listRecent/listLightweight/snapshot/export)',
  },
  {
    spec: 'src/__tests__/perf-sync-scan-probe.test.ts',
    marker: 'PERF_SYNC_JSON:',
    prefix: 'perf-sync-scan',
    note: 'progression quest/achievement sync scan costs',
  },
];

function runProbe(probe, stamp) {
  const outFile = path.join(baselinesDir, `${probe.prefix}-${stamp}.json`);
  console.log(`[perf] running ${probe.spec} (${probe.note}; seeds up to 20k rows)…`);
  const jestArgs = ['jest', probe.spec, '--runInBand'];
  // Windows cannot spawn npx.cmd without a shell; with shell:true pass one
  // command string so Node does not warn about unescaped args (DEP0190).
  const spawnEnv = { ...process.env, PERF_PROBE: '1', PERF_OUT: outFile };
  const result =
    process.platform === 'win32'
      ? spawnSync(`npx ${jestArgs.join(' ')}`, {
          cwd: mobileDir,
          env: spawnEnv,
          encoding: 'utf8',
          shell: true,
        })
      : spawnSync('npx', jestArgs, {
          cwd: mobileDir,
          env: spawnEnv,
          encoding: 'utf8',
        });

  // Jest always prints the full log; surface it for transparency.
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const jsonLine = (result.stdout ?? '')
    .split('\n')
    .find((line) => line.includes(probe.marker));

  if (!jsonLine) {
    console.error(`[perf] no ${probe.marker} line found; probes failed?`);
    return false;
  }

  const json = jsonLine.slice(jsonLine.indexOf(probe.marker) + probe.marker.length).trim();
  // PERF_OUT already persisted the raw object inside the jest process; rewrite
  // here too so a missing env var can never lose the baseline.
  writeFileSync(outFile, `${JSON.stringify(JSON.parse(json), null, 2)}\n`);
  console.log(`[perf] baseline written: ${path.relative(repoRoot, outFile)}`);
  return result.status === 0;
}

mkdirSync(baselinesDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
let ok = true;
for (const probe of PROBES) {
  ok = runProbe(probe, stamp) && ok;
}
process.exit(ok ? 0 : 1);
