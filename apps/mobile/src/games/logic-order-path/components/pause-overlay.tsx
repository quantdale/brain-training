/**
 * Per-game adapter over the shared `PauseOverlay`. Injects the gameId so the
 * screen's `<PauseOverlay onResume onQuit />` call site stays stable.
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
