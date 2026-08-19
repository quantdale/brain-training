/**
 * @/components/game-ui — shared generic game UI primitives (task 10.2).
 *
 * Canonical extraction of the per-game copies that drifted across the
 * 20-game catalog (button, pause overlay, QA panel, tutorial frame,
 * result rows, session header, difficulty selector).
 *
 * Keep mechanics out: these components are theme-aware layout/controls
 * only. Game-specific logic stays in the per-game modules.
 */

export { GameButton } from './game-button';
export type { GameButtonProps } from './game-button';

export { PauseOverlay } from './pause-overlay';
export type { PauseOverlayProps } from './pause-overlay';

export { TutorialFrame } from './tutorial-frame';
export type { TutorialFrameProps } from './tutorial-frame';

export { QaPanelShell } from './qa-panel-shell';
export type { QaPanelShellProps } from './qa-panel-shell';

export { ResultRow, StatRow } from './result-row';
export type { ResultRowProps } from './result-row';

export { SessionHeader } from './session-header';
export type { SessionHeaderProps } from './session-header';

export { DifficultySelector } from './difficulty-selector';
export type { DifficultySelectorProps } from './difficulty-selector';
