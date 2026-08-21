/**
 * Explainability captions for Progress metrics (mirrors the transparency
 * pattern of `composite-explainer`): every number shown on a Progress screen
 * can be traced back to stored evidence via one of these fixed derivations.
 *
 * The strings are pure presentation constants — they never restate a value,
 * only *how* the value is derived — so screens render them as static captions
 * next to the metric they explain. Wording is neutral by design: these are
 * records of training activity, not medical or cognitive-efficacy claims.
 */

/** Keys for every explainable Progress metric. */
export type ProgressMetricKey =
  | 'composite'
  | 'domain-rating'
  | 'domain-movement'
  | 'domain-best'
  | 'avg-normalized'
  | 'recent-form'
  | 'best-normalized'
  | 'score'
  | 'accuracy'
  | 'reaction'
  | 'difficulty'
  | 'duration'
  | 'balance'
  | 'activity-calendar'
  | 'recency'
  | 'recent-vs-lifetime';

const NOTES: Readonly<Record<ProgressMetricKey, string>> = {
  composite:
    'Canonical average across all domains. Untrained domains count at the starting rating; stale ones count half.',
  'domain-rating':
    'Current domain rating: the stored value after the latest session that trained this domain.',
  'domain-movement':
    "Net change in this domain's rating between the first and last recorded update inside the selected window.",
  'domain-best':
    'Highest rating ever recorded for this domain in your rating history.',
  'avg-normalized':
    "Mean of each session's normalized result (0–100% of that session's own scoring scale).",
  'recent-form':
    'Mean normalized result across your most recent sessions of this game (up to 5).',
  'best-normalized': 'Your single best session result ever recorded for this game.',
  score: 'Raw in-game score exactly as the game persisted it; games with different scoring are never compared against each other.',
  accuracy:
    'Share of answered items the game recorded as correct, when it stores one (0–100%).',
  reaction:
    'Representative response time the game stored per session; lower is faster. Only shown for games that persist it.',
  difficulty:
    "The session's challenge rating on the game's 0–100% difficulty scale, as stored at play time.",
  duration: 'Wall-clock time from session start to completion, as stored.',
  balance:
    'Each session counts toward its game\u2019s primary domain. Shares are that domain\u2019s fraction of sessions in the selected window.',
  'activity-calendar':
    'Count of completed sessions per UTC day, matching how the rest of the product buckets activity.',
  recency: 'Whole days since your most recent completed session.',
  'recent-vs-lifetime':
    'The recent average covers only sessions inside the selected window; the lifetime average covers every stored session.',
};

/** The fixed derivation sentence for a metric (deterministic, testable). */
export function explainMetric(key: ProgressMetricKey): string {
  return NOTES[key];
}
