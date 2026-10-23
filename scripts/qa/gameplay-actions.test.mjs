/**
 * gameplay-actions.test.mjs — unit tests for the ONE shared gameplay action
 * policy (node --test). The entry family is a regression pin for the confirmed
 * `memory-prospective-cue` stall: `briefing-start` / `start` / `go` were not
 * recognized as round-entry affordances, so every driver idled on a briefing
 * or intro screen and reported a healthy game as never progressing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ENTRY_RE, SELECTOR_RE, center, chooseGameplayAction } from './gameplay-actions.mjs';

const b = (x1, y1) => ({ bounds: [x1, y1, x1 + 40, y1 + 40] });

test('entry: briefing-start is chosen on a briefing surface', () => {
  const action = chooseGameplayAction({
    briefing: b(0, 0),
    'briefing-chip.2': b(10, 10),
    'briefing-start': b(20, 20),
    'briefing-start-lip': b(21, 21),
    stage: b(0, 0),
  }, new Set());
  assert.equal(action?.target, 'briefing-start');
});

test('entry: intro `start` is chosen when no answer surface exists', () => {
  const action = chooseGameplayAction({
    intro: b(0, 0),
    start: b(30, 30),
    'start-lip': b(31, 31),
    'difficulty.normal': b(5, 5),
    help: b(0, 0),
  }, new Set());
  assert.equal(action?.target, 'start');
});

test('entry: `go` opens a timed round', () => {
  const action = chooseGameplayAction({
    'window-track': b(0, 0),
    go: b(40, 40),
  }, new Set());
  assert.equal(action?.target, 'go');
});

test('entry: `restart` is NOT an entry control (verb must start a token)', () => {
  assert.equal(ENTRY_RE.test('restart'), false);
  assert.equal(ENTRY_RE.test('results-restart'), false);
  const action = chooseGameplayAction({
    results: b(0, 0),
    restart: b(30, 30),
    'result-headline': b(0, 0),
  }, new Set());
  assert.equal(action, null);
});

test('entry: cosmetic -lip overlays are never tapped', () => {
  const action = chooseGameplayAction({
    'briefing-start-lip': b(21, 21),
  }, new Set());
  assert.equal(action, null);
});

test('answers beat entries: a selector is preferred over go/start', () => {
  const action = chooseGameplayAction({
    'verdict-option.0': b(10, 10),
    'verdict-option.1': b(20, 20),
    go: b(40, 40),
  }, new Set());
  assert.equal(action?.target, 'verdict-option.0');
});

test('submits beat entries: submit is preferred over go', () => {
  const action = chooseGameplayAction({
    submit: b(15, 15),
    go: b(40, 40),
  }, new Set());
  assert.equal(action?.target, 'submit');
});

test('entry: bare `start` outranks a decorated entry', () => {
  const action = chooseGameplayAction({
    'stream-start': b(10, 10),
    start: b(20, 20),
  }, new Set());
  assert.equal(action?.target, 'start');
});

test('selector regex still matches the recorded answer vocabulary', () => {
  for (const k of ['tile.3', 'verdict-option.0', 'peg', 'swatch.2', 'choice', 'digit.5']) {
    assert.equal(SELECTOR_RE.test(k), true, `expected selector match: ${k}`);
  }
  for (const k of ['score', 'stage', 'pause', 'briefing-start', 'verdict-prompt', 'round.1']) {
    assert.equal(SELECTOR_RE.test(k), false, `expected no selector match: ${k}`);
  }
});

test('keypad family taps keys even though they are not selectors', () => {
  const controls = {
    'key.7': b(10, 10),
    'key.3': b(20, 20),
  };
  // Inventory order first, then cycling through the used-control set.
  assert.equal(chooseGameplayAction(controls, new Set())?.target, 'key.7');
  assert.equal(chooseGameplayAction(controls, new Set(['key.7']))?.target, 'key.3');
});

test('center rounds to tap coordinates', () => {
  assert.deepEqual(center([0, 0, 10, 10]), [5, 5]);
  assert.equal(center(null), null);
});
