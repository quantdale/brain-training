/**
 * QaPanel — dev-only force-state controls. Generic shell is shared; the
 * per-game `force-timeout` extra renders through the shell's `extraActions`.
 */
import { GameButton, QaPanelShell } from '@/components/game-ui';

import { testId } from '@/sdk';
import { GAME_ID } from '../types';

export interface QaPanelProps {
  onForceWin: () => void;
  onForceLose: () => void;
  onForceTimeout: () => void;
}

export function QaPanel({ onForceWin, onForceLose, onForceTimeout }: QaPanelProps) {
  return (
    <QaPanelShell
      gameId={GAME_ID}
      onForceWin={onForceWin}
      onForceLose={onForceLose}
      extraActions={
        <GameButton
          small
          variant="secondary"
          testID={testId(GAME_ID, 'force-timeout')}
          label="Force timeout"
          onPress={onForceTimeout}
        />
      }
    />
  );
}
