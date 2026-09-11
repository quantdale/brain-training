/**
 * ProgressTrack — thin horizontal meter for shell cards.
 *
 * Thin adapter over the kit's `ProgressBar` so shell callers share one meter
 * implementation (animated fill, tone tokens, `progressbar` role) instead of a
 * second bar with its own literal track colour.
 */

import { ProgressBar } from '@/components/ui/progress-bar';
import type { ThemeColor } from '@/theme/tokens';

/** Tones historically used by shell meters; all resolve to token families. */
export type ProgressTrackTone = 'accent' | 'xp' | 'streak' | 'success';

const TONE_COLOR: Record<ProgressTrackTone, ThemeColor> = {
  accent: 'accent',
  xp: 'xp',
  streak: 'streak',
  success: 'success',
};

export function ProgressTrack({
  ratio,
  height = 6,
  tone = 'accent',
  testID,
}: {
  /** Completion ratio; values outside [0, 1] are clamped. */
  ratio: number;
  height?: number;
  /** Fill tone: brand accent (default), XP/level, streak flame, success. */
  tone?: ProgressTrackTone;
  testID?: string;
}) {
  return <ProgressBar value={ratio} height={height} tone={TONE_COLOR[tone]} testID={testID} />;
}
