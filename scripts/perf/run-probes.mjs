#!/usr/bin/env node
/**
 * W13 performance baseline probe runner (campaign 009).
 *
 * Executes the opt-in measurement spec
 * `apps/mobile/src/__tests__/perf-baseline-probe.test.ts` under jest with
 * PERF_PROBE=1, captures its PERF_BASELINE_JSON report line, and writes a
 * timestamped JSON baseline into scripts/perf/baselines/.
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

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(baselinesDir, `perf-baseline-${stamp}.json`);

mkdirSync(baselinesDir, { recursive: true });

console.log('[perf] running baseline probes (this seeds up to 20k rows; may take ~1 min)…');
const jestArgs = ['jest', 'src/__tests__/perf-baseline-probe.test.ts', '--runInBand'];
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
  .find((line) => line.includes('PERF_BASELINE_JSON:'));

if (!jsonLine) {
  console.error(`[perf] no PERF_BASELINE_JSON line found; probes failed?`);
  process.exit(result.status ?? 1);
}

const json = jsonLine.slice(jsonLine.indexOf('PERF_BASELINE_JSON:') + 'PERF_BASELINE_JSON:'.length).trim();
writeFileSync(outFile, `${JSON.stringify(JSON.parse(json), null, 2)}\n`);
console.log(`\n[perf] baseline written: ${path.relative(repoRoot, outFile)}`);
