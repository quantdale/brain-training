/**
 * Per-game adapter — migrated to shared `PauseOverlay` (campaign 006R canary A).
 * Injects the gameId so existing `<PauseOverlay onResume onQuit />` call sites stay stable.
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
