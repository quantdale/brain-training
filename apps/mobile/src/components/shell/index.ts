/**
 * Shared shell presentational components (W13).
 *
 * Consumed by the shell screens (home/games/profile/results/game-detail/
 * data-management). Built on the UI kit (`@/components/ui`) and the theme
 * tokens, so shell surfaces and kit surfaces cannot drift apart.
 */
export { StateCard, type StateCardVariant, type StateCardAction } from './state-card';
export { SectionHeader } from './section-header';
export { ProgressTrack } from './progress-track';
export { FeedbackCard, type FeedbackCardTone, type FeedbackCardProps } from './feedback-card';
export { StreakCard, type StreakCardProps } from './streak-card';
export { LevelCard, type LevelCardProps } from './level-card';
export { formatRelativeDay, performanceBand, type PerformanceBand } from './format';
