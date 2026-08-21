/**
 * QaPanel — dev-only force-state controls for the Word Chain game (campaign 006R).
 *
 * Generic shell (toggle + force buttons) is shared via `QaPanelShell`; the
 * per-game `force-timeout` extra is rendered through the shell's `extraActions`
 * slot so game mechanics stay local. The screen's existing imports
 * (`./components/qa-panel`) and testIDs stay stable.
 */
import { GameButton, QaPanelShell } from "@/components/game-ui";

import { testId } from "@/sdk";
import { GAME_ID } from "../types";

export interface QaPanelProps {
    onForceWin: () => void;
    onForceLose: () => void;
    onForceTimeout: () => void;
}

export function QaPanel({
    onForceWin,
    onForceLose,
    onForceTimeout,
}: QaPanelProps) {
    return (
        <QaPanelShell
            gameId={GAME_ID}
            onForceWin={onForceWin}
            onForceLose={onForceLose}
            extraActions={
                <GameButton
                    small
                    variant="secondary"
                    testID={testId(GAME_ID, "force-timeout")}
                    label="Force timeout"
                    onPress={onForceTimeout}
                />
            }
        />
    );
}
