/**
 * Shared workout UI components (campaign 010 / W24; campaign 026 identity).
 *
 * Presentational surfaces over the Workout V2 engine (`src/workout/**`):
 * template/length picking, completion summaries, and history rows. Built on
 * the design-language v3 kit (`@/components/ui`) and theme tokens — kit
 * `Chip` selectors, `ProgressBar` meters, `StatBlock` metric columns,
 * `ListRow` outcome feeds, and the code-native `Spark` mark. Components are
 * clock-free (callers inject `nowMs`) and registry-free (callers inject name
 * resolvers) so they stay deterministic under test.
 */
export { formatDurationMs, localDayStartMs } from './format';
export {
  WorkoutLengthChips,
  WorkoutTemplateChips,
  type TemplateResumeInfo,
} from './template-picker';
export { WorkoutCompletionCard } from './completion-summary-card';
export { WorkoutHistoryRow } from './history-row';
export {
  WorkoutTemplateDetails,
  type TemplateDetailsResume,
} from './template-details';
export { WorkoutFocusExplanation } from './focus-explanation';
