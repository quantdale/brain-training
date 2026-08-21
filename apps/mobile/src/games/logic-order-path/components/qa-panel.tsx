import { testId } from '@/sdk';
import { GameButton, QaPanelShell } from '@/components/game-ui';

import { GAME_ID } from '../types';
import type { OrderPathQaForceStateHooks } from '../hooks';

/** Dev-only QA controls for Order Path (rendered only when `isDevBuild()`). */
export function QaPanel({ hooks }: { hooks: OrderPathQaForceStateHooks }) {
  return (
    <QaPanelShell
      gameId={GAME_ID}
      onForceWin={hooks.forceWin}
      onForceLose={hooks.forceLose}
      extraActions={
        <GameButton
          small
          variant="danger"
          testID={testId(GAME_ID, 'force-timeout')}
          label="Force timeout"
          onPress={hooks.forceTimeout}
        />
      }
    />
  );
}
