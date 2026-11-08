/**
 * Display-only regression: the answer phase shows the shared `Countdown` for
 * the real round window, hides it while paused, and remounts it with the
 * true remaining fraction on resume.
 */
import { describe, it, jest } from '@jest/globals';

import { runCountdownContract } from '@/components/game-ui/__tests__/countdown-contract';

import TargetCountScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

describe('attention-target-count countdown', () => {
  it('shows the round-window bar in the answer phase and not while paused', async () => {
    await runCountdownContract({ gameId: GAME_ID, Screen: TargetCountScreen, elapsedMs: 1000 });
  });
});
