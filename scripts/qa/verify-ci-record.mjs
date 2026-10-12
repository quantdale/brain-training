// Verify every CI run ID recorded in VERDICT.md is a real run at the SHA the
// record claims. Guards against fabricated identifiers in durable evidence.
import { execFileSync } from 'node:child_process';

const LIST = execFileSync('gh', ['run', 'list', '--limit', '250', '--json', 'databaseId,name,conclusion,headSha,status'], { encoding: 'utf8' });
const runs = JSON.parse(LIST);

const want = [
  ['38291051610', '5a50eb7'],
  ['38291051629', '5a50eb7'],
  ['38291051702', '5a50eb7'],
  ['38291051671', '5a50eb7'],
  ['38217246446', 'e3cfb8f'],
  ['38217246390', 'e3cfb8f'],
  ['38217246457', 'e3cfb8f'],
  ['38217246383', 'e3cfb8f'],
  ['38220311950', '8f12b1c'],
  ['38220311860', '8f12b1c'],
  ['38220311984', '8f12b1c'],
  ['38220311941', '8f12b1c'],
];

let bad = 0;
for (const [id, sha] of want) {
  const r = runs.find((x) => String(x.databaseId) === id);
  if (!r) {
    console.log(`${id} NOT FOUND in last 250 runs`);
    bad += 1;
    continue;
  }
  const shaOk = r.headSha.startsWith(sha);
  const ok = shaOk && r.conclusion === 'success';
  if (!ok) bad += 1;
  console.log(`${id} ${r.name} @${r.headSha.slice(0, 7)} ${r.status}/${r.conclusion} ${ok ? 'OK' : 'MISMATCH'}`);
}
console.log(bad === 0 ? 'ALL RECORDED RUN IDS REAL AND GREEN' : `${bad} PROBLEM(S)`);
process.exit(bad === 0 ? 0 : 1);
