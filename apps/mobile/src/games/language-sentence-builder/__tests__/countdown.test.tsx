/**
 * Display-only regression: the puzzle phase shows the shared `Countdown` for
 * the real per-sentence budget, hides it while paused, and remounts it with
 * the true remaining fraction on resume.
 */
import { describe, it, jest } from '@jest/globals';

import { runCountdownContract } from '@/components/game-ui/__tests__/countdown-contract';

import SentenceBuilderScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

describe('language-sentence-builder countdown', () => {
  it('shows the budget bar in the puzzle phase and not while paused', async () => {
    await runCountdownContract({ gameId: GAME_ID, Screen: SentenceBuilderScreen, elapsedMs: 1000 });
  });
});
