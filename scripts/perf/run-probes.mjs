#!/usr/bin/env node
/**
 * W13 performance baseline probe runner (campaign 009; extended campaign 012).
 *
 * Executes the opt-in measurement specs under jest, captures each spec's
 * `PERF_*_JSON:` report line, and writes timestamped JSON baselines into
 * scripts/perf/baselines/. Each probe declares its own env switches; PERF_OUT
 * is always set to the baseline file for the probe.
 *
 * The five probes (cheap→expensive; the large-backup probe is heavy and runs last):
 *
 * - apps/mobile/src/__tests__/perf-baseline-probe.test.ts        → PERF_BASELINE_JSON     (PERF_PROBE=1)
 * - apps/mobile/src/__tests__/perf-sync-scan-probe.test.ts       → PERF_SYNC_JSON         (PERF_PROBE=1)
 * - apps/mobile/src/__tests__/perf-quest-eval-ab.test.ts         → PERF_QUEST_AB_JSON     (PERF_PROBE=1)
 * - apps/mobile/src/analytics/__tests__/projections-differential.test.ts → PERF_W10_JSON   (PERF_PROBE=1)
 * - apps/mobile/src/data-portability/__tests__/large-backup-memory.test.ts → LARGE_BACKUP_MEMORY_JSON (LARGE_BACKUP_PROBE=1)
 *
 * Usage (from repo root):
 *   node scripts/perf/run-probes.mjs           # run every probe, write baselines
 *   node scripts/perf/run-probes.mjs --list    # print the probe list and exit 0 (runs nothing)
 *   node scripts/perf/run-probes.mjs --help    # show usage
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

/**
 * Spec files + the JSON marker line each prints, plus the env switches that
 * opt the probe into measuring. Order: cheap→expensive (heavy probe last).
 */
const PROBES = [
  {
    spec: 'src/__tests__/perf-baseline-probe.test.ts',
    marker: 'PERF_BASELINE_JSON:',
    prefix: 'perf-baseline',
    env: { PERF_PROBE: '1' },
    note: 'history-read costs (listRecent/listLightweight/snapshot/export)',
  },
  {
    spec: 'src/__tests__/perf-sync-scan-probe.test.ts',
    marker: 'PERF_SYNC_JSON:',
    prefix: 'perf-sync-scan',
    env: { PERF_PROBE: '1' },
    note: 'progression quest/achievement sync scan costs',
  },
  {
    spec: 'src/__tests__/perf-quest-eval-ab.test.ts',
    marker: 'PERF_QUEST_AB_JSON:',
    prefix: 'perf-quest-ab',
    env: { PERF_PROBE: '1' },
    note: 'quest evaluation A/B split (opt-in timing)',
  },
  {
    spec: 'src/analytics/__tests__/projections-differential.test.ts',
    marker: 'PERF_W10_JSON:',
    prefix: 'perf-projection-w10',
    env: { PERF_PROBE: '1' },
    note: 'progress projection vs legacy read cost (opt-in timing)',
  },
  {
    spec: 'src/data-portability/__tests__/large-backup-memory.test.ts',
    marker: 'LARGE_BACKUP_MEMORY_JSON:',
    prefix: 'perf-large-backup',
    env: { LARGE_BACKUP_PROBE: '1' },
    note: '20k-session large-backup memory/streaming measurement (heavy)',
  },
];

function printUsage() {
  console.log(`Usage: node scripts/perf/run-probes.mjs [--list] [--help]

Runs the opt-in performance measurement probes under jest and writes a
timestamped JSON baseline for each into scripts/perf/baselines/.

Options:
  --list    Print one line per probe (prefix, spec, env switches, marker,
            note) and exit 0 without running jest.
  --help    Show this usage message.

Each probe enables its measurement via its own env switches (shown by
--list); PERF_OUT is always set to the probe's baseline file.`);
}

function printProbeList() {
  for (const probe of PROBES) {
    const envSwitches = Object.entries(probe.env)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    console.log(
      `${probe.prefix} | ${probe.spec} | env: ${envSwitches} | marker: ${probe.marker} | ${probe.note}`,
    );
  }
}

const cliArgs = process.argv.slice(2);
if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
  printUsage();
  process.exit(0);
}
if (cliArgs.includes('--list')) {
  printProbeList();
  process.exit(0);
}

function runProbe(probe, stamp) {
  const outFile = path.join(baselinesDir, `${probe.prefix}-${stamp}.json`);
  console.log(`[perf] running ${probe.spec} (${probe.note}; seeds up to 20k rows)…`);
  const jestArgs = ['jest', probe.spec, '--runInBand'];
  // Windows cannot spawn npx.cmd without a shell; with shell:true pass one
  // command string so Node does not warn about unescaped args (DEP0190).
  const spawnEnv = { ...process.env, ...probe.env, PERF_OUT: outFile };
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
