/**
 * Per-game adapter — delegates to the shared `PauseOverlay` primitive
 * (`@/components/game-ui`). Injects the gameId so the screen's
 * `<PauseOverlay onResume onQuit />` call site stays stable; generic pause
 * surface only (opaque cover; the board is hidden while paused).
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
