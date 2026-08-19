/**
 * Per-game adapter — migrated to shared `PauseOverlay` (campaign 006R canary B).
 * Preserves the local `PauseOverlayProps` contract (no `gameId` prop) so
 * `screen.tsx` stays green; the shared primitive is invoked with `GAME_ID`.
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
