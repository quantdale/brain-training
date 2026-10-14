import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import CoordinateScreen from '../screen';
import { gameReducer as coordinateReducer, createInitialSpatialCoordinateTurnState } from '../reducer';
import { OptionGrid } from '../../spatial-fold-match/components/option-grid';
import { OptionButton } from '../../spatial-transform-match/components/option-button';
import { BlockShape } from '../../spatial-mental-rotation/components/block-shape';
import FoldScreen from '../../spatial-fold-match/screen';
import { gameReducer as foldReducer, createInitialSpatialFoldMatchState } from '../../spatial-fold-match/reducer';
import TransformScreen from '../../spatial-transform-match/screen';
import { gameReducer as transformReducer, createInitialState as createTransformState } from '../../spatial-transform-match/reducer';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));

describe('spatial presented figure and score semantics', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('Fold Match describes the actual option cells before any verdict is revealed', async () => {
    await render(<OptionGrid index={0} grid={[[true, false], [false, true]]} selected={false} correct={false} />);
    const label = screen.getByTestId('spatial-fold-match.option.0').props.accessibilityLabel as string;
    expect(label).toContain('2 rows by 2 columns');
    expect(label).toContain('row 1 column 1');
    expect(label).toContain('row 2 column 2');
    expect(label).not.toMatch(/correct|wrong|fold/i);
  });

  it('Transform Match describes the actual option cells before any verdict is revealed', async () => {
    await render(<OptionButton index={0} gridSize={9} pattern={[0, 5]} selected={false} correct={false} />);
    const label = screen.getByTestId('spatial-transform-match.option.0').props.accessibilityLabel as string;
    expect(label).toContain('3 rows by 3 columns');
    expect(label).toContain('row 1 column 1');
    expect(label).toContain('row 2 column 3');
    expect(label).not.toMatch(/correct|wrong|rotate|mirror/i);
  });

  it('Mental Rotation describes rendered positions and color groups without announcing the relation', async () => {
    await render(<BlockShape kind="candidate" blocks={[{ x: -1, y: 0, colorIndex: 0 }, { x: 0, y: 1, colorIndex: 2 }]} />);
    const label = screen.getByTestId('spatial-mental-rotation.candidate.shape').props.accessibilityLabel as string;
    expect(label).toContain('2 rows by 2 columns');
    expect(label).toContain('row 1 column 1, color group 1');
    expect(label).toContain('row 2 column 2, color group 3');
    expect(label).not.toMatch(/same|different|correct|rotate|mirror/i);
  });

  it('the real expert Coordinate Turn command list explicitly requests 45-degree turns', async () => {
    const id = 'spatial-coordinate-turn';
    const seed = '077-explicit-expert-turn';
    const store = createInMemoryTutorialStore();
    store.setTutorialState(id, { completed: true, replayRequested: false, version: '1.0.0' });
    const selected = coordinateReducer(createInitialSpatialCoordinateTurnState(), { type: 'select-difficulty', level: 'expert' });
    const state = coordinateReducer(selected, { type: 'start-session', seed, sessionId: 'plan', startedAtMs: 0 });
    await render(<CoordinateScreen clock={createFakeClock()} tutorialStore={store} sessionSeed={seed} />);
    await fireEvent.press(screen.getByTestId(testId(id, 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId(id, 'start')));
    const turns = state.round!.commands.map((command, index) => ({ command, index })).filter(({ command }) => command.type === 'left' || command.type === 'right');
    expect(turns.length).toBeGreaterThan(0);
    for (const { command, index } of turns) {
      expect(screen.getByTestId(testId(id, 'command', String(index)))).toHaveTextContent(`${index + 1}. Turn ${command.type} 45°`);
    }
  });

  it.each([
    { id: 'spatial-fold-match', Screen: FoldScreen, initial: () => foldReducer(createInitialSpatialFoldMatchState(), { type: 'start-session', seed: '077-rounded-score', sessionId: 'plan', startedAtMs: 0 }), revealMs: 1300 },
    { id: 'spatial-transform-match', Screen: TransformScreen, initial: () => transformReducer(createTransformState(), { type: 'start-session', seed: '077-rounded-score', sessionId: 'plan', startedAtMs: 0 }), revealMs: 1500 },
  ])('$id rounds the HUD score while preserving the precise raw score', async (fixture) => {
    const store = createInMemoryTutorialStore();
    store.setTutorialState(fixture.id, { completed: true, replayRequested: false, version: '1.0.0' });
    const clock = createFakeClock();
    const state = fixture.initial();
    const completeSession = jest.fn(async (input: CompleteSessionInput) => ({ session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }));
    await render(<fixture.Screen clock={clock} tutorialStore={store} sessionSeed="077-rounded-score" persistSession={{ completeSession }} />);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'start')));
    await act(async () => { clock.advance(fixture.revealMs); jest.advanceTimersByTime(fixture.revealMs); });
    await act(async () => { clock.advance(100); jest.advanceTimersByTime(100); });
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'option', String(state.correctOptionIndex))));
    expect(screen.getByTestId(testId(fixture.id, 'score'))).toHaveTextContent(/^Score \d+$/);
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(fixture.id, 'force-lose')));
    await act(async () => {});
    const input = completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as { score: number };
    expect(raw.score).toBeGreaterThan(Math.floor(raw.score));
  });
});
