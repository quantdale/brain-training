/**
 * QaPanel — speed Reaction Time QA (canary B).
 *
 * Uses shared `QaPanelShell`; per-game `force-timeout` is injected via
 * `extraActions` so the generic shell stays mechanics-free.
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
