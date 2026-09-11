/**
 * `Entrance` — staggered mount transition for a screen's content blocks.
 *
 * The research is explicit that a dense screen should arrive as a sequence
 * rather than one block, and equally explicit that motion must never delay
 * interaction. This wrapper is the compromise: children are mounted and
 * hit-testable from the first frame; only opacity and a short rise animate,
 * and under reduced motion the block renders in its final state immediately.
 *
 * Usage — index blocks in visual order:
 *   <Entrance index={0}>{hero}</Entrance>
 *   <Entrance index={1}>{sections}</Entrance>
 */

import type { ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { useEntranceTransition } from './motion';

/** Props accepted by {@link Entrance}. */
export interface EntranceProps {
  children: ReactNode;
  /** Position in the visual order; the delay is `index * Motion.stagger`. */
  index?: number;
  /** Set false for content that must not animate (e.g. dense data grids). */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Entrance({ children, index = 0, enabled = true, style, testID }: EntranceProps) {
  const animatedStyle = useEntranceTransition({ index, enabled });
  return (
    <Animated.View style={[style, animatedStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
}
