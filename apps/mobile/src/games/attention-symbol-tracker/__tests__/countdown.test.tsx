/**
 * Display-only regression: the respond phase (not the observe reveal) shows
 * the shared `Countdown` for the real respond window, hides it while paused,
 * and remounts it with the true remaining fraction on resume.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';

import {
  expectCountdownAbsent,
  runCountdownContract,
} from '@/components/game-ui/__tests__/countdown-contract';
import { testId } from '@/sdk';

import { SYMBOL_TRACKER_DIFFICULTY_PARAMS } from '../difficulty';
import SymbolTrackerScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal;

describe('attention-symbol-tracker countdown', () => {
  it('shows the respond-window bar only in the respond phase and not while paused', async () => {
    await runCountdownContract({
      gameId: GAME_ID,
      Screen: SymbolTrackerScreen,
      elapsedMs: 1000,
      toAnswerPhase: async (advance) => {
        // The observe reveal is a memorise phase: no bar there.
        expect(screen.getByTestId(testId(GAME_ID, 'observe-board'))).toBeOnTheScreen();
        expectCountdownAbsent(GAME_ID);
        await advance(NORMAL.observeMs);
        expect(screen.getByTestId(testId(GAME_ID, 'respond-status'))).toBeOnTheScreen();
      },
    });
  });
});
