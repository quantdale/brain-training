/**
 * Display-only regression: the question phase shows the shared `Countdown`
 * for the real round deadline, hides it while paused, and remounts it with
 * the true remaining fraction on resume.
 */
import { describe, it, jest } from '@jest/globals';

import { runCountdownContract } from '@/components/game-ui/__tests__/countdown-contract';

import LanguageWordMatchScreen from '../screen';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

describe('language-word-match countdown', () => {
  it('shows the deadline bar in the question phase and not while paused', async () => {
    await runCountdownContract({ gameId: GAME_ID, Screen: LanguageWordMatchScreen, elapsedMs: 1000 });
  });
});
