/**
 * QaPanel — dev-only force-state controls for Sequence Memory (canary A).
 *
 * Uses shared `QaPanelShell` for the toggle + force-win/lose chrome;
 * per-game extra `force-perfect` is injected via the generic `extraActions`
 * slot so game mechanics stay local and no drifted shell copy is needed.
 */
import { testId } from '@/sdk';
import { GameButton, QaPanelShell } from '@/components/game-ui';

import { GAME_ID } from '../types';

export interface QaPanelProps {
  onForceWin: () => void;
  onForceLose: () => void;
  onForcePerfect: () => void;
}

export function QaPanel({ onForceWin, onForceLose, onForcePerfect }: QaPanelProps) {
  return (
    <QaPanelShell
      gameId={GAME_ID}
      onForceWin={onForceWin}
      onForceLose={onForceLose}
      extraActions={
        <GameButton
          small
          testID={testId(GAME_ID, 'force-perfect')}
          label="Force perfect"
          onPress={onForcePerfect}
        />
      }
    />
  );
}
