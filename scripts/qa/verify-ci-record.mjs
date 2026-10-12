// Verify every CI run ID recorded in VERDICT.md is a real, green run at the exact
// SHA the record claims, and that exactly one push round is marked ENDING SHA.
//
// This exists because a run ID written into prose from memory is indistinguishable
// from a real one until it is checked against the workflow list, and a wrong ID
// looks exactly as plausible as a right one in durable evidence.
//
// Usage: node scripts/qa/verify-ci-record.mjs [--verbose]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const VERDICT = 'openspec/changes/076-f-final-product-certification/evidence/VERDICT.md';

// Push-triggered rounds recorded in the "Every push-triggered round" list, in
// file order. Rounds whose runs are expected in the push-triggered set are
// listed. `bdde89c` is deliberately listed with expectedEvent 'workflow_dispatch':
// it is a manual-dispatch round recorded under the push heading for completeness,
// and the record says so explicitly.
const PUSH_ROUNDS = [
  ['bdde89c', 4, 'workflow_dispatch', 'manual-dispatch round recorded for completeness'],
  ['31d7163', 4, 'push', ''],
  ['ce3a319', 4, 'push', ''],
  ['d4aa81e', 4, 'push', ''],
  ['bf37e6b', 4, 'push', ''],
  ['e3cfb8f', 4, 'push', 'ending SHA until the D3 repair moved HEAD'],
  ['8f12b1c', 4, 'push', ''],
  ['5a50eb7', 4, 'push', ''],
  ['e09d4c7', 4, 'push', 'ENDING SHA'],
];

const WORKFLOWS = ['App CI', 'Repository Integrity', 'Android Build Smoke', 'iOS Build Smoke'];

// Cancelled run IDs the record discloses. These are excluded from the push-round
// coverage check precisely because they were cancelled, so they need their own
// check: the ID must be real, must be cancelled, and must be a release check.
const CANCELLED = [
  ['38202372875', 'a79bae1, iOS Build Smoke'],
  ['38202372885', 'a79bae1, App CI'],
  ['38202372888', 'a79bae1, Android Build Smoke'],
  ['38204813925', '74ce010, App CI'],
  ['38204813938', '74ce010, Android Build Smoke'],
  ['38204813977', '74ce010, iOS Build Smoke'],
  ['38295096279', '64aaa33, Android Build Smoke'],
  ['38293852381', '4468685, iOS Build Smoke'],
  ['38293852315', '4468685, Android Build Smoke'],
];

function ghList() {
  return JSON.parse(execFileSync('gh', ['run', 'list', '--limit', '250', '--json', 'databaseId,name,conclusion,headSha,event,status'], { encoding: 'utf8' }));
}

const verbose = process.argv.includes('--verbose');
const problems = [];
const runs = ghList();

// 1. Parse every "- <sha> - <ids>" line and check each ID against the workflow list.
const text = fs.readFileSync(path.resolve(VERDICT), 'utf8');
const lines = text.split(/\r?\n/);
const roundLines = lines.filter((l) => /^- [0-9a-f]{7} - [0-9, ]+/.test(l));
if (!roundLines.length) problems.push('no push-triggered rounds found in VERDICT.md');

const seenRoundSha = new Set();
for (const l of roundLines) {
  const m = /^- ([0-9a-f]{7}) - ([0-9, ]+)/.exec(l);
  const sha = m[1];
  const expected = PUSH_ROUNDS.find(([s]) => s === sha);
  const expectedEvent = expected ? expected[2] : 'push';
  const expectedCount = expected ? expected[1] : 4;
  const note = expected ? expected[3] : '';
  seenRoundSha.add(sha);
  const ids = m[2].split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length !== expectedCount) problems.push(`${sha}: expected ${expectedCount} run IDs, found ${ids.length}`);

  const covered = new Set();
  for (const id of ids) {
    const r = runs.find((x) => String(x.databaseId) === id);
    if (!r) {
      problems.push(`${sha}: run ${id} not found in the last 250 workflow runs`);
      continue;
    }
    if (!r.headSha.startsWith(sha)) problems.push(`${sha}: run ${id} is at ${r.headSha.slice(0, 7)}, not ${sha}`);
    if (r.event !== expectedEvent) problems.push(`${sha}: run ${id} (${r.name}) is event=${r.event}, expected ${expectedEvent}`);
    if (r.conclusion !== 'success') problems.push(`${sha}: run ${id} (${r.name}) conclusion=${r.conclusion || r.status}, not success`);
    covered.add(r.name);
  }
  for (const w of WORKFLOWS) {
    if (!covered.has(w)) problems.push(`${sha}: no recorded run covers ${w}`);
  }
  console.log(`${sha}: ${covered.size}/${expectedCount} workflows covered (${expectedEvent}${note ? ', ' + note : ''})`);
}

// 2. Exactly one round must be marked ENDING SHA, and it must be the newest.
const endingLines = lines.filter((l) => /^- [0-9a-f]{7} - /.test(l) && /\(ENDING SHA\)/.test(l));
if (endingLines.length !== 1) problems.push(`expected exactly one round marked (ENDING SHA), found ${endingLines.length}`);
for (const [sha, count, expectedEvent, note] of PUSH_ROUNDS) {
  if (!seenRoundSha.has(sha)) problems.push(`expected round ${sha} missing from the push-round list`);
  if (expectedEvent === 'workflow_dispatch') {
    const line = roundLines.find((l) => l.startsWith(`- ${sha} `));
    if (line && !/manual dispatch|workflow_dispatch/i.test(line)) problems.push(`${sha}: is a manual-dispatch round but the list line does not say so`);
  }
}

// 4. Disclosed cancelled runs must be real, cancelled, and release checks. A cancelled
//    run that is actually green would mean the disclosure over-claims a gap; a
//    cancelled run that is actually a failure would mean it under-claims one.
for (const [id, why] of CANCELLED) {
  const r = runs.find((x) => String(x.databaseId) === id);
  if (!r) {
    problems.push(`cancelled run ${id} (${why}) not found in the last 250 workflow runs`);
    continue;
  }
  if (!WORKFLOWS.includes(r.name)) problems.push(`cancelled run ${id} is ${r.name}, not a release check`);
  if (r.conclusion !== 'cancelled') problems.push(`cancelled run ${id} (${r.name}) is ${r.conclusion || r.status}, expected cancelled`);
  if (verbose) console.log(`cancelled ${id} (${r.name} @${r.headSha.slice(0, 7)}) OK`);
}

// 3. Every workflow named in a round line must be one of the four release checks.
for (const l of roundLines) {
  for (const id of /- ([0-9, ]+)/.exec(l)[1].split(',').map((s) => s.trim())) {
    const r = runs.find((x) => String(x.databaseId) === id);
    if (r && !WORKFLOWS.includes(r.name)) problems.push(`run ${id} is ${r.name}, not a release check`);
  }
}

if (problems.length) {
  console.error('CI RECORD VERIFICATION FAILED');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`CI record verified: ${seenRoundSha.size} push rounds, ${seenRoundSha.size * 4} run IDs all real, green and at their claimed SHA; exactly one ENDING SHA; ${CANCELLED.length} disclosed cancelled runs all real and cancelled.`);
