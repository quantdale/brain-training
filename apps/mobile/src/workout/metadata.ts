/**
 * Workout Engine V2 — metadata model + instance identity.
 *
 * A workout *instance* is one persisted row in `workout_instances`. Its
 * primary key (the `date` column) is treated as a string **instance key**:
 *
 * - the default daily workout keeps the bare local date (`2026-08-21`) as its
 *   key — byte-identical to the pre-V2 format, so every existing row, query
 *   and consumer keeps working unchanged;
 * - template workouts (focus/domain-targeted structures started by the
 *   player; see `templates.ts`) use namespaced keys
 *   `<date>::<templateId>::<length>`, which the same TEXT primary key stores
 *   without any schema change. `parseInstanceKey` is the single decoder.
 *
 * Metadata (template id, length, focus, generation inputs) is versioned via
 * {@link WORKOUT_METADATA_VERSION}. It travels on the in-memory instance and
 * is persisted into an optional `metadata_json` column when the schema
 * provides it (see the NEEDS_PARENT note in
 * `.agent/_tasks/campaign010/W06.md`); every code path degrades gracefully
 * when the column does not exist yet. Selection itself stays deterministic:
 * re-running a selection with the recorded inputs always reproduces the same
 * game list for the same version.
 */

import type { GameCategory } from "@/sdk";

/**
 * Schema version of {@link WorkoutMetadata}. Bump whenever the shape changes
 * so persisted/serialized metadata can be interpreted correctly.
 */
export const WORKOUT_METADATA_VERSION = 1;

/**
 * Selector version stamped onto template-workout instances. The legacy daily
 * selector (`@/workout/today` + `personalize`) persists `seedVersion: 1`;
 * V2 template selection bumps to 2 so provenance distinguishes the two.
 */
export const WORKOUT_SELECTION_SEED_VERSION = 2;

/** Workout length variants (constitution §14: "normally four games" = standard). */
export type WorkoutLength = "short" | "standard" | "extended";

/** Whether an instance is the default daily mix or a player-started template. */
export type WorkoutKind = "daily" | "template";

/** True when `value` is one of the named workout lengths. */
export function isWorkoutLength(value: unknown): value is WorkoutLength {
  return (
    value === "short" || value === "standard" || value === "extended"
  );
}

/**
 * Snapshot of the inputs a selection was computed from (provenance,
 * constitution §10/§21: generated artifacts record their versions and
 * inputs). Stored with the instance metadata when persistence allows.
 */
export interface WorkoutGenerationInputs {
  /** Domain rating snapshot at creation time (domain → rating). */
  domainRatings: Record<string, number>;
  /** Recently played game ids at creation time (newest first). */
  recentGameIds: string[];
  /** Canonical RNG seed the selection was drawn from. */
  seed: string;
}

/** Versioned metadata attached to every V2 workout instance. */
export interface WorkoutMetadata {
  /** {@link WORKOUT_METADATA_VERSION} of the producing engine. */
  version: number;
  kind: WorkoutKind;
  /** Stable template id (`daily-mix` for the default; see `templates.ts`). */
  templateId: string;
  length: WorkoutLength;
  /** Targeted cognitive domain, or null for mixed workouts. */
  focus: GameCategory | null;
  /** Generation-input snapshot (present when the caller supplied one). */
  inputs?: WorkoutGenerationInputs;
}

/* ------------------------------------------------------------------ *
 * Instance keys
 * ------------------------------------------------------------------ */

/** Separator between the date and the template parts of an instance key. */
export const INSTANCE_KEY_SEPARATOR = "::";

/** Key of the default daily workout for a local calendar date. */
export function dailyInstanceKey(date: string): string {
  return date;
}

/** Key of a template workout instance for `(date, templateId, length)`. */
export function templateInstanceKey(
  date: string,
  templateId: string,
  length: WorkoutLength,
): string {
  return `${date}${INSTANCE_KEY_SEPARATOR}${templateId}${INSTANCE_KEY_SEPARATOR}${length}`;
}

/** Decoded parts of an instance key (see module comment). */
export interface ParsedInstanceKey {
  /** Local calendar date (YYYY-MM-DD) the instance belongs to. */
  date: string;
  kind: WorkoutKind;
  /** Template id for template keys; null for daily keys (and malformed ones). */
  templateId: string | null;
  /** Length variant for template keys; null for daily keys (and malformed). */
  length: WorkoutLength | null;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Decode an instance key. Unknown/malformed shapes never throw: they degrade
 * to `{ kind: 'template', templateId: null, length: null }` keyed by their
 * leading date-like segment, so history rendering stays robust against
 * future key formats instead of crashing on them.
 */
export function parseInstanceKey(key: string): ParsedInstanceKey {
  const segments = key.split(INSTANCE_KEY_SEPARATOR);
  if (segments.length === 1) {
    return { date: key, kind: "daily", templateId: null, length: null };
  }
  const [date, templateId, length] = segments;
  return {
    date,
    kind: "template",
    templateId: templateId ?? null,
    length: isWorkoutLength(length) ? length : null,
  };
}

/** Whether `key` addresses a template (non-daily) instance. */
export function isTemplateInstanceKey(key: string): boolean {
  return key.includes(INSTANCE_KEY_SEPARATOR);
}

/* ------------------------------------------------------------------ *
 * Seeds
 * ------------------------------------------------------------------ */

/**
 * Canonical seed of the DAILY selection for `(date, attempt)` — mirrors the
 * format built inline in `today.ts` (`workout::<date>::<attempt>`). Kept as a
 * local constant here (instead of refactoring today.ts) so the frozen daily
 * path is untouched; a test pins the two formats together.
 */
export function dailySelectionSeed(date: string, attempt = 0): string {
  return `workout::${date}::${attempt}`;
}

/** Canonical seed of a TEMPLATE selection for its full identity tuple. */
export function templateSelectionSeed(
  date: string,
  templateId: string,
  length: WorkoutLength,
  attempt = 0,
): string {
  return `workout::${date}::${templateId}::${length}::${attempt}`;
}

/* ------------------------------------------------------------------ *
 * Factories + defensive parsing
 * ------------------------------------------------------------------ */

/** Build versioned metadata for a workout instance. */
export function createWorkoutMetadata(input: {
  kind: WorkoutKind;
  templateId: string;
  length: WorkoutLength;
  focus: GameCategory | null;
  inputs?: WorkoutGenerationInputs;
}): WorkoutMetadata {
  return {
    version: WORKOUT_METADATA_VERSION,
    kind: input.kind,
    templateId: input.templateId,
    length: input.length,
    focus: input.focus,
    ...(input.inputs ? { inputs: input.inputs } : {}),
  };
}

/**
 * Parse an unknown JSON value (a `metadata_json` cell) into
 * {@link WorkoutMetadata}, returning undefined for absent/malformed payloads
 * so one drifted row can never crash a history read (same policy as
 * `game_ids_json` parsing in db/workout.ts).
 */
export function parseWorkoutMetadata(raw: unknown): WorkoutMetadata | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  if (
    typeof value.version !== "number" ||
    (value.kind !== "daily" && value.kind !== "template") ||
    typeof value.templateId !== "string" ||
    !isWorkoutLength(value.length)
  ) {
    return undefined;
  }
  const focus =
    typeof value.focus === "string" ? (value.focus as GameCategory) : null;
  return {
    version: value.version,
    kind: value.kind,
    templateId: value.templateId,
    length: value.length,
    focus,
  };
}
