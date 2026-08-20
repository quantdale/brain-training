/**
 * QaPanel — dev-only force-state controls for the Spatial Grid Navigator game.
 *
 * Generic shell (toggle + force buttons) is shared via `QaPanelShell`; this
 * thin wrapper just maps the game's `QaForceStateHooks` into the shared
 * `gameId + onForceWin/onForceLose` contract so the screen's existing imports
 * (`./components/qa-panel`) and testIDs stay stable. Grid Navigator also
 * exposes a per-game "Force timeout" dev action via `QaPanelShell.extraActions`.
 */
import { GameButton, QaPanelShell } from '@/components/game-ui';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';

export interface QaPanelProps {
  onForceWin: () => void;
  onForceLose: () => void;
  /** Optional dev-only "clock expired mid-run" shortcut. */
  onForceTimeout?: () => void;
}

export function QaPanel({ onForceWin, onForceLose, onForceTimeout }: QaPanelProps) {
  return (
    <QaPanelShell
      gameId={GAME_ID}
      onForceWin={onForceWin}
      onForceLose={onForceLose}
      extraActions={
        onForceTimeout !== undefined ? (
          <GameButton
            small
            variant="secondary"
            testID={testId(GAME_ID, 'qa-force-timeout')}
            label="Force timeout"
            onPress={onForceTimeout}
          />
        ) : null
      }
    />
  );
}
