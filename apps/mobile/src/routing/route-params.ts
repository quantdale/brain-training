/**
 * App-owned route input envelope (Campaign 053, task 2.5).
 *
 * Route query values are untrusted input: a crafted deep link can supply an
 * oversized or malformed `id`, `gameId`, `domain`, `workoutKey`, or
 * `workoutIndex`. Before this module, each route coerced params inline
 * (`typeof x === 'string' ? x : ''`), which accepted arbitrary lengths and
 * deferred any bound checking to downstream lookups.
 *
 * This envelope enforces the canonical parameter forms and bounds derived
 * from the existing catalog/session contract:
 *
 * - game ids are generated-registry ids: lowercase segments separated by `-`
 *   (`attention-odd-one-out`, `memory`, ...); the registry itself is the
 *   authority for membership, this module only bounds the FORM;
 * - workout instance keys are `<date>` or `<date>::<templateId>::<length>`
 *   (see `@/workout/metadata`), both bounded well under 128 chars;
 * - workout leg indices are non-negative safe integers within the longest
 *   supported workout length (`MAX_WORKOUT_LEG_INDEX`, derived from the
 *   extended length variant).
 *
 * DEFENSE IN DEPTH ATTRIBUTION (spec: dependency-route-safety): this
 * validation runs in application code AFTER expo-router/query-string have
 * already parsed the URL. It cannot remediate upstream decoder work such as
 * the accepted `decode-uri-component` ReDoS advisory
 * (GHSA-vcc3-ghjq-m6fr, tracked in
 * scripts/certification/dependency-audit-allowlist.json); it only ensures a
 * malformed or oversized parameter can never reach game/session selection or
 * persistence.
 */
import { getGameDefinition } from '@/registry/registry';
import { isGameCategory } from '@/sdk';

/**
 * Maximum accepted length for any app-owned route identifier. Registry game
 * ids are far shorter (longest current id is under 32 chars) and instance
 * keys are `<YYYY-MM-DD>::<templateId>::<length>` (under 64); 128 leaves
 * headroom for future ids without accepting arbitrary payloads.
 */
export const MAX_ROUTE_PARAM_LENGTH = 128;

/**
 * Maximum accepted workout leg index. The longest length variant is
 * `extended` = 6 games (`workout/templates`), so 5 is the highest leg any
 * real workout can own. Kept as a literal (not an import) so this
 * startup-path envelope never inherits the workout selection module graph;
 * `routing/__tests__/route-params.test.ts` asserts equality with the
 * templates authority (056).
 */
export const MAX_ROUTE_LEG_INDEX = 5;

/**
 * Canonical generated-registry game id form: lowercase alphanumeric segments
 * separated by single hyphens (`memory`, `attention-odd-one-out`).
 */
const CANONICAL_GAME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Canonical workout instance-key segments (see `@/workout/metadata`). */
const CANONICAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CANONICAL_TEMPLATE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORKOUT_LENGTHS = new Set(['short', 'standard', 'extended']);

/** Coerce a route param (string | string[] | undefined) to one string. */
function firstRouteValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null;
  }
  return typeof value === 'string' ? value : null;
}

/** Bounded-length guard shared by every envelope check. */
function isBounded(value: string): boolean {
  return value.length > 0 && value.length <= MAX_ROUTE_PARAM_LENGTH;
}

/**
 * Validate a canonical game id form. Returns the id when accepted, otherwise
 * `null`; callers route to their safe fallback. Membership in the registry is
 * intentionally NOT required here — an unregistered-but-canonical id already
 * has a dedicated not-found fallback, and this function must stay pure.
 */
export function parseCanonicalGameId(value: unknown): string | null {
  const candidate = firstRouteValue(value);
  if (candidate === null || !isBounded(candidate)) {
    return null;
  }
  return CANONICAL_GAME_ID.test(candidate) ? candidate : null;
}

/**
 * Validate a route game id AND require it to resolve in the registered
 * catalog. Route consumers that load or persist a selected target (game
 * route, game detail, results) use this so a malformed or oversized value
 * cannot select or persist anything.
 */
export function parseRegisteredGameId(value: unknown): string | null {
  const candidate = parseCanonicalGameId(value);
  if (candidate === null) {
    return null;
  }
  return getGameDefinition(candidate) ? candidate : null;
}

/**
 * Validate a canonical workout instance key: a local date (`YYYY-MM-DD`) or
 * `<date>::<templateId>::<length>` (see `@/workout/metadata`).
 */
export function parseCanonicalInstanceKey(value: unknown): string | null {
  const candidate = firstRouteValue(value);
  if (candidate === null || !isBounded(candidate)) {
    return null;
  }
  const segments = candidate.split('::');
  if (segments.length === 1) {
    return CANONICAL_DATE.test(segments[0] ?? '') ? candidate : null;
  }
  if (segments.length !== 3) {
    return null;
  }
  const [date, templateId, length] = segments;
  if (
    !CANONICAL_DATE.test(date ?? '') ||
    !CANONICAL_TEMPLATE_ID.test(templateId ?? '') ||
    !WORKOUT_LENGTHS.has(length ?? '')
  ) {
    return null;
  }
  return candidate;
}

/**
 * Validate a workout leg index: a non-negative safe integer within the
 * longest supported workout length. Accepts the string form route params
 * arrive as.
 */
export function parseBoundedLegIndex(value: unknown): number | null {
  const raw = firstRouteValue(value);
  if (raw === null || raw.length === 0 || raw.length > 8) {
    return null;
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_ROUTE_LEG_INDEX) {
    return null;
  }
  return parsed;
}

/**
 * Validate a progress domain key. The canonical form is the SDK
 * `GameCategory` label (`Memory`, `Logic & Problem Solving`, ...) because the
 * production Progress links encode the category label directly
 * (`/progress-domain?domain=Memory`). Unknown-but-well-formed labels already
 * render the honest empty-domain state.
 */
export function parseCanonicalDomain(value: unknown): string | null {
  const candidate = firstRouteValue(value);
  if (candidate === null || !isBounded(candidate) || !isGameCategory(candidate)) {
    return null;
  }
  return candidate;
}

/**
 * Validate a results session id. Session ids are generated by
 * `createSessionId` as `<gameId>-<base36 time>-<base36 counter>-<suffix>`;
 * the envelope accepts a bounded canonical token (letters, digits, hyphen,
 * underscore) so malformed/oversized deep links fall back to the recoverable
 * empty state instead of being looked up.
 */
export function parseCanonicalSessionId(value: unknown): string | null {
  const candidate = firstRouteValue(value);
  if (candidate === null || !isBounded(candidate)) {
    return null;
  }
  return /^[A-Za-z0-9_-]+$/.test(candidate) ? candidate : null;
}
