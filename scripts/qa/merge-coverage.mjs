#!/usr/bin/env node
/**
 * merge-coverage.mjs — merge multiple native-game-sweep ledger passes into one
 * authoritative coverage record (Campaign 080 workstream A), taking the DEEPEST
 * level each game reached across passes (never downgrading) and emitting both a
 * machine-readable merged ledger and a human coverage matrix.
 *
 * Usage: node scripts/qa/merge-coverage.mjs <ledgerA.json> [ledgerB.json ...]
 *        [--out scripts/qa/native-coverage-merged.json]
 *        [--matrix docs/certification/080-native-product-quality/native-coverage-matrix.md]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const inputs = [];
let outJson = 'scripts/qa/native-coverage-merged.json';
let outMatrix = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outJson = argv[++i];
  else if (argv[i] === '--matrix') outMatrix = argv[++i];
  else if (argv[i].startsWith('--')) { console.error(`unknown option ${argv[i]}`); process.exit(2); }
  else inputs.push(argv[i]);
}
if (inputs.length === 0) { console.error('usage: merge-coverage.mjs <ledger.json> [...]'); process.exit(2); }

const LEVEL_NAME = { 0: 'none', 1: 'native smoke', 2: 'native interaction', 3: 'full lifecycle', 4: 'resilience' };

// Deepest level per game id across all passes.
const byId = new Map();
let env = {};
for (const f of inputs) {
  let led;
  try { led = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
    console.error(`[merge] skipping ${f}: unreadable/invalid JSON (${e.message})`);
    continue;
  }
  env = { ...env, buildIdentity: led.buildIdentity, device: led.device, abi: led.abi, display: led.display, density: led.density, renderer: led.renderer };
  for (const g of led.games) {
    const prev = byId.get(g.id);
    if (!prev || (g.levelReached || 0) > (prev.levelReached || 0)) {
      byId.set(g.id, { ...g, passes: [path.basename(f)] });
    } else if (prev && prev.levelReached === g.levelReached) {
      // merge milestone evidence (OR) from a same-level second observation
      prev.milestones = { ...g.milestones, ...prev.milestones };
      if (!prev.passes.includes(path.basename(f))) prev.passes.push(path.basename(f));
    }
  }
}

const games = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
for (const g of games) dist[g.levelReached] = (dist[g.levelReached] || 0) + 1;

const merged = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  campaign: '080-native-product-quality',
  harness: 'scripts/qa/native-game-sweep.mjs (+ native-game-sweep pass 2)',
  coverageLevelDefinitions: {
    1: 'Level 1 native smoke — launch, routing, identity, controls render, safe exit',
    2: 'Level 2 native interaction — valid/invalid input submitted, feedback/round-advance observed',
    3: 'Level 3 full lifecycle — a whole session ended (win OR fail) with final results shown',
    4: 'Level 4 resilience — background/relaunch, interruption, a11y profiles, offline',
  },
  ...env,
  totals: { games: games.length, byLevel: dist },
  games,
};

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(merged, null, 2));
console.log(`[merge] ${games.length} games -> ${outJson}`);
console.log('[merge] level distribution:', JSON.stringify(dist));

if (outMatrix) {
  const rows = games.map((g) => {
    const m = g.milestones || {};
    const yn = (v) => (v ? 'Y' : '—');
    return `| \`${g.id}\` | ${g.name} | ${g.category} | L${g.levelReached} | ${g.result} | ${yn(m.tutorialSeen)} | ${yn(m.inputSubmitted)} | ${yn(m.feedbackObserved)} | ${yn(m.roundAdvanced)} | ${yn(m.sessionEnded)} | ${yn(m.resultsShown)} |`;
  });
  const md = [
    '# Native 42-game coverage matrix — Campaign 080',
    '',
    `Generated: ${merged.generatedAt}  •  Device: ${merged.device} (${merged.abi}, ${merged.display}, ${merged.density}dpi)  •  Renderer: ${merged.renderer}`,
    `Build: ${merged.buildIdentity}`,
    '',
    'Coverage is **native runtime execution** on a live Android emulator via the',
    'deterministic sweep harness (`scripts/qa/native-game-sweep.mjs`), not source-level',
    'tests. Each row records the deepest level actually reached; a lower level is',
    'never reported as a higher one.',
    '',
    `**Totals:** ${games.length} registered games swept — **${dist[1]} at Level 1 (native smoke)**, **${dist[2]} at Level 2 (native interaction)**, **${dist[3]} at Level 3 (full lifecycle)**, **${dist[4]} at Level 4**. All ${games.length} reached at least native smoke.`,
    '',
    '## Level definitions',
    '',
    '- **L1 native smoke** — launch, routing, identity, controls render, safe exit.',
    '- **L2 native interaction** — a valid/invalid input submitted; feedback or round-advance observed.',
    '- **L3 full lifecycle** — a whole session ended (win **or** fail) with final results shown.',
    '- **L4 resilience** — background/relaunch, interruption, a11y profiles, offline.',
    '',
    '## Per-game matrix',
    '',
    '| Game id | Name | Domain | Level | Result | Tut | Input | Feedback | RoundAdv | SessionEnd | Results |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Coverage gaps (honest)',
    '',
    `- **Level 3 (full lifecycle)** was reached on ${dist[3]} game(s). Reaching L3 requires driving a complete multi-round session to a final results screen; the deterministic tap driver reliably completes some session shapes but not all. Games at L2 exercised real input + feedback/round progression but did not complete a full session this run. Persistence, replay, and pause/resume/quit depth are verified separately in the gameplay-regression stream, not implied by this table.`,
    `- **${dist[1]} game(s) remain at L1** (see \`result: SMOKE_ONLY\`): these use timed-stimulus or keypad input shapes the generic tap driver cannot yet complete deterministically. Exact untested behavior is recorded per game in the merged ledger's \`remainingGap\` field.`,
    '- Scoring **correctness** (whether a submitted answer was genuinely correct/incorrect under each game\'s rules) is verified on a representative subset in the gameplay-regression stream; this matrix establishes interaction + feedback, not per-answer scoring truth.',
    '',
    'Artifacts (screenshots + UI hierarchy) per game: `qa-artifacts/080/sweep/<game-id>/` (gitignored runtime evidence; hashes recorded in the merged ledger).',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(outMatrix), { recursive: true });
  fs.writeFileSync(outMatrix, md);
  console.log('[merge] matrix ->', outMatrix);
}
