/**
 * Public surface of the assistant seam (campaign 010, W19).
 *
 * Pure, dependency-light grounding for a FUTURE advisory assistant: build a
 * deterministic training-context summary DTO from stored data shapes, plus
 * history transport DTO types. No provider, no network, no persistence, and
 * nothing wired into screens (constitution §22: advisory only — this module
 * can never modify authoritative progression state).
 */

export type {
  AssistantDomain,
  AssistantDomainSnapshot,
  AssistantExchange,
  AssistantExchangeStatus,
  AssistantGameSnapshot,
  AssistantProfileSnapshot,
  AssistantRole,
  AssistantThreadSummary,
  DomainRatingView,
  GameAggregateView,
  RecentSessionView,
  StreakStateView,
} from './types';
export {
  ASSISTANT_CONTEXT_VERSION,
  RECENT_SESSION_LIMIT,
  STALE_DOMAIN_DAYS,
  TOP_GAME_LIMIT,
} from './types';
export { buildAssistantContextSummary } from './context';
export type { AssistantContextArgs } from './context';
