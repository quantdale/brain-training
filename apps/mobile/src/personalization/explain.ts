/**
 * Explainability for Advanced Personalization V2.
 *
 * Two layers, mirroring the `insight-notes` / composite-explainer pattern:
 *
 * 1. Fixed derivation sentences per signal (`explainSignal`) — static captions
 *    a UI can render next to any recommendation to say HOW the signal works.
 * 2. Per-game instance reasons (`format*Detail`) — the concrete "why THIS
 *    game, NOW" strings attached to every scored component. The weak/stale
 *    formatters are shared verbatim with the legacy workout reorder so both
 *    layers word identical evidence identically.
 *
 * Wording is neutral and factual: records of training activity, never medical
 * or cognitive-efficacy claims (constitution §4).
 */

import type { SignalKey } from './types';

/** The fixed derivation sentence for each signal (deterministic, testable). */
export const SIGNAL_EXPLANATIONS: Readonly<Record<SignalKey, string>> = {
  'weak-domain':
    'Your rating in this domain has dropped below its starting value, so training it is prioritized.',
  'undertrained-domain':
    'You have played few sessions in this domain so far, so it is surfaced to build evidence.',
  'stale-domain':
    'This domain has not been trained recently; its rating is marked stale rather than decayed.',
  novelty: 'Games you have barely played get a discovery boost.',
  'performance-trend':
    'Your recent results in this game are above your lifetime average for it.',
  'personal-best-proximity':
    'A personal record for this game is within reach of your recent form.',
  'difficulty-fit':
    'Recent results sit in the productive middle band — challenging but not crushing.',
  overexposure:
    'This game took a large share of your recent sessions, so it steps aside for variety.',
  'composition-fit':
    'Each already-picked game of the same category lowers further picks from that category.',
};

/** The fixed derivation sentence for a signal key. */
export function explainSignal(key: SignalKey): string {
  return SIGNAL_EXPLANATIONS[key];
}

/** Instance reason for a weak domain (shared with the workout layer). */
export function formatWeakDomainDetail(
  domain: string,
  rating: number,
): string {
  return `weak ${domain} domain (rating ${rating})`;
}

/** Instance reason for a stale domain (shared with the workout layer). */
export function formatStaleDomainDetail(
  domain: string,
  rating: number,
  ageDays: number,
): string {
  return `rusty ${domain} domain (rating ${rating}, not played for ~${ageDays}d)`;
}

/** Instance reason for an undertrained domain. */
export function formatUndertrainedDetail(
  domain: string,
  sessions: number,
): string {
  return `undertrained ${domain} domain (${sessions} session${sessions === 1 ? '' : 's'} so far)`;
}

/** Instance reason for the novelty boost. */
export function formatNoveltyDetail(lifetimeSessions: number): string {
  return lifetimeSessions === 0
    ? 'never played yet — discovery boost'
    : `barely played (${lifetimeSessions} session${lifetimeSessions === 1 ? '' : 's'} so far)`;
}

/** Instance reason for the fatigue dampener. */
export function formatOverexposureDetail(
  recentPlays: number,
  windowSize: number,
): string {
  return `${recentPlays} of your last ${windowSize} sessions were this game`;
}

/** Instance reason for the momentum boost; deltas are percentages. */
export function formatTrendDetail(
  recentForm: number,
  lifetimeAvg: number,
): string {
  const delta = Math.round((recentForm - lifetimeAvg) * 100);
  return `recent form ${Math.round(recentForm * 100)}% vs lifetime ${Math.round(
    lifetimeAvg * 100,
  )}% (+${delta}pts)`;
}

/** Instance reason for record proximity; the gap is a percentage. */
export function formatPersonalBestProximityDetail(gap: number): string {
  if (gap <= 0) {
    return 'at your personal best — one good run sets a new record';
  }
  return `within ${Math.round(gap * 100)}pts of your personal best`;
}

/** Instance reason for difficulty fit; the form mean is a percentage. */
export function formatDifficultyFitDetail(meanNormalized: number): string {
  return `recent results average ${Math.round(meanNormalized * 100)}% — inside the productive band`;
}

/** Instance reason for the selection-time composition penalty. */
export function formatCompositionFitDetail(repeats: number): string {
  return `${repeats} picked game${repeats === 1 ? '' : 's'} already share this category`;
}
