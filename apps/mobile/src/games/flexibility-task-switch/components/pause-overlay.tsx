/**
 * Per-game adapter — migrated to shared `PauseOverlay` (campaign 006R).
 * Injects the gameId so the screen's existing `<PauseOverlay onResume onQuit />`
 * call sites stay stable; generic pause surface only.
 */
import { PauseOverlay as SharedPauseOverlay } from "@/components/game-ui";

import { GAME_ID } from "../types";

export interface PauseOverlayProps {
 onResume: () => void;
 onQuit: () => void;
}

export function PauseOverlay({ onResume, onQuit }: PauseOverlayProps) {
 return (
  <SharedPauseOverlay gameId={GAME_ID} onResume={onResume} onQuit={onQuit} />
 );
}
