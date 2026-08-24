/**
 * QaPanel — dev-only force-state controls for the Task Switch game (campaign 006R).
 *
 * Generic shell (toggle + force buttons) is shared via `QaPanelShell`; this
 * thin wrapper just maps the game's `QaForceStateHooks` into the shared
 * `gameId + onForceWin/onForceLose` contract so the screen's existing imports
 * (`./components/qa-panel`) and testIDs stay stable. Cue Shift also exposes a
 * per-game "Force timeout" dev action via `QaPanelShell.extraActions`.
 */
import { QaPanelShell } from "@/components/game-ui";

import { GAME_ID } from "../types";

export interface QaPanelProps {
 onForceWin: () => void;
 onForceLose: () => void;
}

export function QaPanel({ onForceWin, onForceLose }: QaPanelProps) {
 return (
  <QaPanelShell
   gameId={GAME_ID}
   onForceWin={onForceWin}
   onForceLose={onForceLose}
  />
 );
}
