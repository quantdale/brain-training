/**
 * QaPanel — spatial Mental Rotation QA (canary C).
 *
 * Uses shared `QaPanelShell`; `forceTimeout` is per-game extra via `extraActions`.
 */
import { testId } from '@/sdk';
import { GameButton, QaPanelShell } from '@/components/game-ui';

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
