import { GameButton as SharedGameButton } from '@/components/game-ui';
import type { ComponentProps } from 'react';

/** Local adapter over the shared `GameButton` (keeps per-game imports stable). */
export function GameButton(props: ComponentProps<typeof SharedGameButton>) {
  return <SharedGameButton {...props} />;
}
