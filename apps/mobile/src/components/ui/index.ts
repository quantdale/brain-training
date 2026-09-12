/**
 * UI kit — the app's shared interactive vocabulary.
 *
 * Screens compose these primitives instead of writing their own pills, cards,
 * rows and meters. The kit owns: press feedback, haptics, reduced-motion
 * behaviour, the 44 dp interaction floor, token discipline and accessibility
 * defaults — so a screen cannot accidentally opt out of the contract.
 *
 * Import everything from `@/components/ui`.
 */

// Interaction foundation
export { Tappable, pressStyles, type TappableProps } from './tappable';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './button';
export { IconButton, type IconButtonProps } from './icon-button';
export { Card, type CardPadding, type CardProps, type CardVariant } from './card';
export { SectionGrid, type SectionGridProps } from './section-grid';
export { BackLink, type BackLinkProps } from './back-link';
export { Entrance, type EntranceProps } from './entrance';
export { HAIRLINE, ICON_BUTTON_SIZE, RADIUS_CAP } from './radius';

// Content primitives
export { Chip, type ChipProps } from './chip';
export { Badge, type BadgeProps, type BadgeSize } from './badge';
export { ListRow, type ListRowProps } from './list-row';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { Skeleton, SkeletonText, type SkeletonProps } from './skeleton';
export { Avatar, type AvatarProps, type AvatarSize } from './avatar';
export { TextField, type TextFieldProps } from './text-field';
export { Spark, type SparkProps } from './spark';
export { Confetti, CONFETTI_COLORS, type ConfettiProps } from './confetti';
export { StreakStrip, type StreakStripProps } from './streak-strip';
export {
  ToastHost,
  showToast,
  resetToastQueueForTests,
  type ToastOptions,
} from './toast';

// Metrics + navigation chrome
export { ProgressBar, type ProgressBarProps } from './progress-bar';
export { ProgressRing, type ProgressRingProps } from './progress-ring';
export { AnimatedNumber, type AnimatedNumberProps } from './animated-number';
export { StatBlock, type StatBlockProps } from './stat-block';
export { ScreenHeader, type ScreenHeaderProps } from './screen-header';
export { SegmentedControl, type SegmentOption, type SegmentedControlProps } from './segmented-control';

// Motion helpers shared by screens that need bespoke animation
export {
  PRESS_SCALE,
  useAnimatedProgress,
  useEntranceTransition,
  usePressFeedback,
  type EntranceOptions,
  type PressFeedback,
  type PressFeedbackOptions,
} from './motion';
