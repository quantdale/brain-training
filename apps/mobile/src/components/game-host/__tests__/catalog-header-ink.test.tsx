/** Stage headers must not use paper-neutral ink. Board-local ink is untouched. */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StyleSheet } from 'react-native';
import * as ts from 'typescript';

import SymbolTracker from '@/games/attention-symbol-tracker/screen';
import ColorStroop from '@/games/flexibility-color-stroop/screen';
import GridRecall from '@/games/memory-grid-recall/screen';
import ProspectiveCue from '@/games/memory-prospective-cue/screen';
import SequenceMemory from '@/games/memory-sequence-memory/screen';
import QuickCompare from '@/games/speed-quick-compare/screen';
import { createFakeClock, createInMemoryTutorialStore } from '@/sdk';
import { Colors } from '@/theme/tokens';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/hooks/use-theme', () => {
  const { Colors: palettes } = jest.requireActual<typeof import('@/theme/tokens')>('@/theme/tokens');
  return { useTheme: () => palettes[mockScheme] };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));

const cases = [
  { id: 'flexibility-color-stroop', Screen: ColorStroop, labels: ['score', 'rule'], primary: 'trial.1' },
  { id: 'speed-quick-compare', Screen: QuickCompare, labels: ['streak'], primary: 'round.1' },
  { id: 'attention-symbol-tracker', Screen: SymbolTracker, labels: ['observe-status'], primary: 'round.1' },
  { id: 'memory-grid-recall', Screen: GridRecall, labels: ['study-status'], primary: 'round.1' },
  { id: 'memory-sequence-memory', Screen: SequenceMemory, labels: ['countdown'], primary: 'round.1' },
  { id: 'memory-prospective-cue', Screen: ProspectiveCue, labels: [], primary: 'round.1' },
];

function ink(id: string) {
  return StyleSheet.flatten(screen.getByTestId(id).props.style).color;
}

describe('catalog stage-header ink', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  for (const scheme of ['light', 'dark'] as const) {
    it.each(cases)(`${scheme}: $id renders secondary readouts on the stage`, async ({ id, Screen, labels, primary }) => {
      mockScheme = scheme;
      const store = createInMemoryTutorialStore();
      store.setTutorialState(id, { completed: true, replayRequested: false, version: '1.0.0' });
      await render(<Screen clock={createFakeClock()} tutorialStore={store} sessionSeed="header-ink" />);
      await fireEvent.press(screen.getByTestId(`${id}.start`));
      for (const label of labels) expect(ink(`${id}.${label}`)).toBe(Colors[scheme].stageMuted);
      expect(ink(`${id}.${primary}`)).toBe(Colors[scheme].stageInk);
      expect(screen.getByTestId(`${id}.pause`)).toBeOnTheScreen();
      if (id !== 'flexibility-color-stroop') expect(ink(`${id}.score-live`)).toBe(Colors[scheme].text);
      if (id === 'speed-quick-compare') {
        // This label is on the mechanic's paper panel, not in the stage HUD.
        expect(StyleSheet.flatten(screen.getByText('Score').props.style).color).toBe(Colors[scheme].textSecondary);
      }
    });
  }

  it('scopes its catalog tripwire to actual header JSX, never whole mechanic boards', () => {
    const games = resolve(__dirname, '../../../games');
    let inspected = 0;
    for (const game of readdirSync(games)) {
      let source: string;
      try { source = readFileSync(resolve(games, game, 'screen.tsx'), 'utf8'); } catch { continue; }
      inspected++;
      const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node) {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === 'AnimatedNumber') {
          const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
          const id = attributes.find(attr => attr.name.getText(ast) === 'testID');
          if (id?.initializer?.getText(ast).match(/score-(live|final)/)) {
            const color = attributes.find(attr => attr.name.getText(ast) === 'themeColor');
            // Paper scores use text; existing stage scores legitimately use
            // stageInk. Neither passive role may borrow the action accent.
            expect(color === undefined ? '"text"' : color.initializer?.getText(ast)).toMatch(/^['"](?:text|stageInk)['"]$/);
          }
        }
        if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'header') {
          function check(child: ts.Node) {
            if (ts.isJsxAttribute(child) && child.name.getText(ast) === 'themeColor') {
              expect(child.initializer?.getText(ast)).not.toMatch(/^['"](?:text|textSecondary|textMuted)['"]$/);
            }
            ts.forEachChild(child, check);
          }
          ts.forEachChild(node, check);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    expect(inspected).toBe(42);
  });
});
