/**
 * Display-only regression: the answer phase shows the shared `Countdown`
 * for the real round budget, hides it while paused, and remounts it with the
 * true remaining fraction on resume.
 */
import { describe, it, jest } from '@jest/globals';

import { runCountdownContract } from '@/components/game-ui/__tests__/countdown-contract';

import MathMissingOperatorScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

describe('math-missing-operator countdown', () => {
  it('shows the budget bar in the answer phase and not while paused', async () => {
    await runCountdownContract({ gameId: GAME_ID, Screen: MathMissingOperatorScreen, elapsedMs: 1000 });
  });
});
