/**
 * GameButton — thin re-export of the shared primitive (canary C migration).
 */
/**
 * AnswerButton — the "Same" / "Different" mental-rotation answer control.
 *
 * `memo`ized and value-based (`onPressAnswer` carries the `RoundKind`) so the
 * buttons do not re-render on the 250 ms round-clock ticks — only the timer
 * bar and any genuinely changed state do. The shared `GameButton` already
 * supplies `accessibilityRole="button"` and the neutral `label` text.
 */
import { memo } from 'react';

import { GameButton } from '@/components/game-ui';
import type { GameButtonProps } from '@/components/game-ui';

import type { RoundKind } from '../types';

export { GameButton } from '@/components/game-ui';
export type { GameButtonProps } from '@/components/game-ui';

export interface AnswerButtonProps extends Omit<GameButtonProps, 'onPress'> {
  answer: RoundKind;
  onPressAnswer?: (answer: RoundKind) => void;
}

export const AnswerButton = memo(function AnswerButton({
  answer,
  onPressAnswer,
  ...rest
}: AnswerButtonProps) {
  return (
    <GameButton
      {...rest}
      onPress={() => onPressAnswer?.(answer)}
    />
  );
});
