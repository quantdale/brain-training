import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, liveAudioHaptics, testId } from '@/sdk';
import type { GameButtonProps } from '@/components/game-ui/game-button';

import { ORDER_PATH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import OrderPathScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));
const mockPressCallbacks = new Map<string, () => void>();
jest.mock('@/components/game-ui', () => {
  const actual = jest.requireActual<typeof import('@/components/game-ui')>('@/components/game-ui');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, GameButton: (props: GameButtonProps) => {
    mockPressCallbacks.set(props.testID, props.onPress);
    return React.createElement(actual.GameButton, props);
  } };
});

describe('Order Path queued caller presses', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPressCallbacks.clear();
    jest.spyOn(liveAudioHaptics, 'feedback').mockImplementation(() => {});
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('claims each new placement once before React commits the next cursor', async () => {
    const seed = 'queued-path';
    const store = createInMemoryTutorialStore();
    store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
    await render(<OrderPathScreen clock={createFakeClock()} tutorialStore={store} sessionSeed={seed} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const round = generateRound({
      rng: createRng(seed), roundIndex: 0, prevSolution: null,
      itemCount: ORDER_PATH_DIFFICULTY_PARAMS.normal.itemCount,
      edgeDensityTarget: ORDER_PATH_DIFFICULTY_PARAMS.normal.edgeDensityTarget,
    });
    const first = mockPressCallbacks.get(testId(GAME_ID, 'item', round.solution[0]))!;
    const second = mockPressCallbacks.get(testId(GAME_ID, 'item', round.solution[1]))!;
    await act(async () => { first(); first(); second(); });
    expect(screen.getByTestId(testId(GAME_ID, 'placed', '1'))).toHaveTextContent(`2. ${round.solution[1]}`);
    expect(screen.getByTestId(testId(GAME_ID, 'item', round.solution[0]))).toBeDisabled();
    expect(screen.getByTestId(testId(GAME_ID, 'item', round.solution[2]))).toBeEnabled();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-wrong'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-timeout'))).toBeNull();
    expect(liveAudioHaptics.feedback).toHaveBeenCalledTimes(2);
    expect(liveAudioHaptics.feedback).toHaveBeenNthCalledWith(1, 'correct');
    expect(liveAudioHaptics.feedback).toHaveBeenNthCalledWith(2, 'correct');
  });
});
