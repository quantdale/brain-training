/**
 * Display-only regression: the question phase shows the shared `Countdown`
 * for the real round deadline, hides it while paused, and remounts it with
 * the true remaining fraction on resume.
 */
import { describe, it, jest } from '@jest/globals';

import { runCountdownContract } from '@/components/game-ui/__tests__/countdown-contract';

import LogicDeductionScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

describe('logic-deduction-table countdown', () => {
  it('shows the deadline bar in the question phase and not while paused', async () => {
    await runCountdownContract({ gameId: GAME_ID, Screen: LogicDeductionScreen, elapsedMs: 1000 });
  });
});
