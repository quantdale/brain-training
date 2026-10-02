import { SCHEMA_VERSION } from '@/db/schema';

/**
 * Forward-compatibility detection (Change 070, design D5 / task 4).
 *
 * THE ASYMMETRY, and why only one direction needs a signal.
 *
 * (Imports `SCHEMA_VERSION` from the database schema rather than hardcoding a
 * number: a hardcoded copy of the app's schema version would go stale silently
 * on the next migration, which is the exact class of bug this check exists to
 * catch — so the constant has one definition and this module reads it.)
 *
 * OLDER backup → NEWER app: additive and safe. A field the newer app expects is
 * simply absent, the newer schema's own defaults apply, and the import succeeds.
 * This is the direction that is already tolerated and tested, and it stays
 * silent — a notice here would train users to ignore notices.
 *
 * NEWER backup → OLDER app: this is the one that loses data. A field, section,
 * or schema version the importing build does not understand is DROPPED on
 * import, and the next export writes it back missing. The user downgrades,
 * restores, and silently loses progress written by their newer app. Nothing
 * errors, nothing is logged, and the loss is permanent.
 *
 * So the unknown content is detected at PREVIEW time — before the user has
 * committed to anything — surfaced with a count and a short description, and
 * made cancellable. Proceeding is still allowed (the user may be restoring on
 * purpose, e.g. moving to a new device) but is recorded as a knowingly lossy
 * import so the choice is explicit rather than accidental.
 *
 * This module only DETECTS and DESCRIBES. The user-facing decision belongs to
 * the data-management screen; what it needs is a machine-readable answer, not
 * a boolean.
 */

/** One class of content this build does not understand. */
export type UnrecognizedKind = 'section' | 'envelope-field' | 'data-field' | 'schema-version';

/** A single thing the importing build does not recognize. */
export interface UnrecognizedItem {
  kind: UnrecognizedKind;
  /** Dotted path, e.g. `data.gameSessions` or `data.profile.streakFreezes`. */
  path: string;
}

/** The complete forward-compatibility verdict for a backup. */
export interface ForwardCompatibilityReport {
  /** True when the backup contains at least one thing this build drops. */
  lossy: boolean;
  /** Everything unrecognized, deduplicated and sorted for stable output. */
  items: UnrecognizedItem[];
  /**
   * A short, user-facing description. Bounded and non-technical in wording: the
   * number first, because that is what tells a user whether to stop and
   * upgrade first.
   */
  summary: string;
}

/**
 * Every `data` section this build understands. A key outside this set is
 * content from a future app version and WILL be dropped on import.
 *
 * Kept as an explicit list rather than derived from the validation code on
 * purpose: the point is to name what THIS build knows, and a derived list would
 * silently absorb a new section without anyone deciding whether an older app
 * can read it.
 */
export const KNOWN_DATA_SECTIONS: readonly string[] = [
  'schemaVersion',
  'profile',
  'gameSessions',
  'domainRatings',
  'ratingHistory',
  'currencyLedger',
  'gameFavorites',
  'xpAwards',
  'tutorialState',
  'workoutInstances',
  'questDefinitions',
  'questProgress',
  'achievementDefinitions',
  'achievementUnlocks',
];

/**
 * Envelope keys this build understands.
 *
 * Every key `buildExportPayload` emits MUST be listed here: this set is what
 * the forward-compatibility detector compares a backup's envelope against, and
 * an omitted self-emitted key makes every backup the app writes look like it
 * came from a newer version (a false data-loss warning on every restore).
 * `appVersion`, `engineVersion` and `manifest` are provenance/summary the
 * import never consumes, so their presence is recognized, not lossy.
 */
export const KNOWN_ENVELOPE_FIELDS: readonly string[] = [
  'format',
  'version',
  'createdAt',
  'schemaVersion',
  'checksumAlgorithm',
  'checksum',
  'data',
  'appVersion',
  'engineVersion',
  'manifest',
];

/**
 * Optional fields on `profile`. A newer app that added a profile field (a
 * streak-freeze inventory, a personalization choice) would have the old build
 * drop it, so their presence is lossy in exactly the same way a whole section is.
 */
const KNOWN_PROFILE_FIELDS: readonly string[] = [
  'id',
  'displayName',
  'settings',
  'createdAt',
  'updatedAt',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Bounded so a hostile or generated backup cannot amplify into UI text. */
const MAX_REPORTED_ITEMS = 20;
const MAX_PATH_LENGTH = 80;

function describePath(path: string): string {
  return path.length > MAX_PATH_LENGTH ? `${path.slice(0, MAX_PATH_LENGTH)}…` : path;
}

/**
 * Compare a parsed envelope against what this build understands.
 *
 * Deliberately does NOT report every unknown KEY inside a known array section
 * (e.g. an extra property on one `gameSessions` row): those are dropped
 * individually and are far more likely to be benign, and enumerating them would
 * make the notice useless on a legitimate newer backup. Section-level and
 * profile-level detection covers the cases that actually lose meaningful data.
 *
 * A NEWER `schemaVersion` is reported: the app's schema may have added tables
 * or columns this build does not have, and restoring such a backup can silently
 * drop them. An OLDER `schemaVersion` is NOT reported — that is the safe,
 * already-tolerated direction.
 */
export function detectUnrecognizedContent(parsed: {
  envelope: Record<string, unknown>;
  data: Record<string, unknown>;
}): ForwardCompatibilityReport {
  const items: UnrecognizedItem[] = [];
  const seen = new Set<string>();

  const add = (kind: UnrecognizedKind, path: string): void => {
    const key = `${kind}:${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ kind, path: describePath(path) });
  };

  for (const key of Object.keys(parsed.envelope)) {
    if (!KNOWN_ENVELOPE_FIELDS.includes(key)) add('envelope-field', key);
  }

  for (const key of Object.keys(parsed.data)) {
    if (!KNOWN_DATA_SECTIONS.includes(key)) add('section', `data.${key}`);
  }

  const profile = parsed.data.profile;
  if (isObject(profile)) {
    for (const key of Object.keys(profile)) {
      if (!KNOWN_PROFILE_FIELDS.includes(key)) add('data-field', `data.profile.${key}`);
    }
  }

  const declaredSchema = parsed.data.schemaVersion ?? parsed.envelope.schemaVersion;
  if (typeof declaredSchema === 'number' && Number.isFinite(declaredSchema)) {
    if (declaredSchema > SCHEMA_VERSION) {
      add(
        'schema-version',
        `data.schemaVersion=${declaredSchema} (this app supports ${SCHEMA_VERSION})`,
      );
    }
  }

  const sorted = items.sort((a, b) => a.path.localeCompare(b.path));
  const lossy = sorted.length > 0;
  if (!lossy) {
    return { lossy: false, items: [], summary: 'This backup uses only data this version of the app understands.' };
  }

  const shown = sorted.slice(0, MAX_REPORTED_ITEMS);
  const remainder = sorted.length - shown.length;
  const list = shown.map((item) => item.path).join(', ');
  const more = remainder > 0 ? `, and ${remainder} more` : '';
  return {
    lossy: true,
    items: sorted,
    summary:
      `This backup was written by a newer version of the app: ${sorted.length} ` +
      `item${sorted.length === 1 ? '' : 's'} (${list}${more}) ` +
      `cannot be restored by this version and will be lost. ` +
      `Update the app first if you can, or continue to restore anyway.`,
  };
}
