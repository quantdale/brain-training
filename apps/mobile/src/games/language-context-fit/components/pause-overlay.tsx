/**
 * Per-game adapter — shared `PauseOverlay`, injects the gameId.
 */
import { PauseOverlay as SharedPauseOverlay } from '@/components/game-ui';

import { GAME_ID } from '../types';

export interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onQuit }: PauseOverlayProps) {
  return <SharedPauseOverlay gameId={GAME_ID} onResume={onResume} onQuit={onQuit} />;
}
