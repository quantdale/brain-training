/**
 * Shared shell presentational components (W13).
 *
 * Consumed by the shell screens (home/games/profile/results/game-detail/
 * data-management). Built strictly on the existing primitives (`ThemedText`,
 * `ThemedView`, `MinTouchTarget`, theme tokens) — no new visual language.
 */
export { StateCard, type StateCardVariant, type StateCardAction } from './state-card';
export { SectionHeader } from './section-header';
export { StatTile } from './stat-tile';
export { InfoRow } from './info-row';
export { ProgressTrack } from './progress-track';
export { formatRelativeDay, performanceBand, type PerformanceBand } from './format';
