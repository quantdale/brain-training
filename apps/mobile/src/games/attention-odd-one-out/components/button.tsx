/**
 * Per-game re-export — migrated to shared `GameButton` (campaign 006R canary A).
 * Keep the local path stable for existing imports; mechanics stay in per-game code.
 */
export { GameButton } from '@/components/game-ui';
export type { GameButtonProps } from '@/components/game-ui';
