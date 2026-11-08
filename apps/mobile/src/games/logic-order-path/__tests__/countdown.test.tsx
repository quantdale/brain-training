/**
 * Display-only regression: the round phase shows the shared `Countdown` for
 * the real round deadline, hides it while paused, and remounts it with the
 * true remaining fraction on resume.
 */
import { describe, it, jest } from '@jest/globals';

import { runCountdownContract } from '@/components/game-ui/__tests__/countdown-contract';

import OrderPathScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

describe('logic-order-path countdown', () => {
  it('shows the deadline bar in the round phase and not while paused', async () => {
    await runCountdownContract({ gameId: GAME_ID, Screen: OrderPathScreen, elapsedMs: 1000 });
  });
});
