/**
 * QaPanel — dev-only force-state controls for the Spatial Fold Match game.
 *
 * Generic shell (toggle + force buttons) is shared via `QaPanelShell`; this
 * thin wrapper just maps the game's callbacks into the shared
 * `gameId + onForceWin/onForceLose` contract so the screen's existing import
 * (`./components/qa-panel`) and testIDs stay stable.
 */
import { QaPanelShell } from '@/components/game-ui';

import { GAME_ID } from '../types';

export interface QaPanelProps {
  onForceWin: () => void;
  onForceLose: () => void;
}

export function QaPanel({ onForceWin, onForceLose }: QaPanelProps) {
  return (
    <QaPanelShell
      gameId={GAME_ID}
      onForceWin={onForceWin}
      onForceLose={onForceLose}
    />
  );
}
