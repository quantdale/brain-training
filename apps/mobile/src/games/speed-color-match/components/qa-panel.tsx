/**
 * QaPanel — thin adapter over the shared `QaPanelShell` (campaign 006R canary B).
 * Preserves local ./components/qa-panel import path while delegating generic
 * toggle/panel shell to the shared primitive.
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
