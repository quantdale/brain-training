/**
 * QaPanel — dev-only force-state controls, mapped onto the shared
 * `QaPanelShell` (toggle + force buttons). The screen renders this only in
 * dev builds.
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
