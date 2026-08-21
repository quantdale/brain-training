/**
 * Shared workout UI components (campaign 010 / W24).
 *
 * Presentational surfaces over the Workout V2 engine (`src/workout/**`):
 * template/length picking, completion summaries, and history rows. Built on
 * the existing shell/a11y primitives — no new visual language. Components
 * are clock-free (callers inject `nowMs`) and registry-free (callers inject
 * name resolvers) so they stay deterministic under test.
 */
export { formatDurationMs, localDayStartMs } from './format';
export { WorkoutLengthChips, WorkoutTemplateChips } from './template-picker';
export { WorkoutCompletionCard } from './completion-summary-card';
export { WorkoutHistoryRow } from './history-row';
