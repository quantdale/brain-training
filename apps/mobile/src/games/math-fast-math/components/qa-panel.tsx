/**
 * QaPanel — thin adapter over the shared `QaPanelShell` (canary C migration).
 * Math's force-win/force-lose pair maps directly onto the 2-button shell.
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
