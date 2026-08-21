/**
 * QaPanel — dev-only force-state controls for the Order Sweep game.
 *
 * Generic shell (toggle + force buttons) is shared via `QaPanelShell`; this
 * thin wrapper maps the game's `onForceWin`/`onForceLose` into the shared
 * `gameId + onForceWin/onForceLose` contract so the screen's import
 * (`./components/qa-panel`) and testIDs stay stable.
 */
import { QaPanelShell } from '@/components/game-ui';

import { GAME_ID } from '../types';

export interface QaPanelProps {
  onForceWin: () => void;
  onForceLose: () => void;
}

export function QaPanel({ onForceWin, onForceLose }: QaPanelProps) {
  return <QaPanelShell gameId={GAME_ID} onForceWin={onForceWin} onForceLose={onForceLose} />;
}
