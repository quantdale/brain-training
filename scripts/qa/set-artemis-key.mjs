/**
 * One-shot helper: replace the ARTEMIS provider credential in the EXTERNAL
 * D:\Tools\artemis\.env file.
 *
 * The key is supplied through an environment variable read from a gitignored
 * local file, and is never printed, logged, or written into this repository.
 * Only the ARTEMIS checkout's own .env is modified - that file is outside the
 * repository and outside Git.
 *
 * Usage:
 *   $env:BT_NEW_KEY = '<key>'; node scripts/qa/set-artemis-key.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ENV_PATH = 'D:/Tools/artemis/.env';
const key = process.env.BT_NEW_KEY;

if (!key) {
  console.error('BT_NEW_KEY is not set; nothing written.');
  process.exit(2);
}
if (!existsSync(ENV_PATH)) {
  console.error(`no ${ENV_PATH}`);
  process.exit(1);
}

const src = readFileSync(ENV_PATH, 'utf8');
const lines = src.split(/\r?\n/);
let replaced = false;
const out = lines.map((line) => {
  if (/^\s*OPENAI_API_KEY\s*=/.test(line)) {
    replaced = true;
    return `OPENAI_API_KEY=${key}`;
  }
  return line;
});
if (!replaced) out.push(`OPENAI_API_KEY=${key}`);

writeFileSync(ENV_PATH, `${out.join('\n')}\n`);
// Report only whether the key changed length class, never the value.
const now = readFileSync(ENV_PATH, 'utf8');
const m = /^\s*OPENAI_API_KEY\s*=\s*(.*)$/m.exec(now);
console.log(`OPENAI_API_KEY updated in ${ENV_PATH} (was present: ${replaced}, length now: ${m ? m[1].length : 0})`);
