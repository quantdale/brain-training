/**
 * Workout Engine V2 — named workout templates + length variants.
 *
 * Templates are named workout structures beyond the default daily mix
 * (constitution §14). Two kinds exist:
 *
 * - `daily-mix` — the default Today's Workout. Its SELECTION PATH IS FROZEN:
 *   it keeps flowing through `personalizedWorkout` (`@/workout/personalize`)
 *   exactly as before. This module only describes it so UI/history can name
 *   it like any other template.
 * - one focus template per browse category (constitution §8), GENERATED from
 *   `GAME_CATEGORIES` — never hand-maintained — targeting a single cognitive
 *   domain. A focus pool prefers games whose `primaryCategory` matches, then
 *   games listing the domain as a `secondaryDomain`, then tops up from the
 *   remaining eligible catalog so short catalogs still fill every slot.
 *
 * Length variants: `short` (2 games), `standard` (4, the constitution
 * default) and `extended` (6). Selection is fully deterministic: seeded via
 * {@link templateSelectionSeed} through the SDK RNG, so the same
 * `(date, templateId, length, attempt)` always yields the same game list.
 *
 * Personalization reuses the EXISTING seam read-only: the pure reorder
 * building blocks exported by `@/workout/personalize` (`rankByRecency`,
 * `reorderByWeakDomains`) order the selection without changing its members,
 * mirroring how the daily path composes them.
 */

import { createRng, GAME_CATEGORIES } from "@/sdk";
import type { GameCategory, GameDefinition, Rng } from "@/sdk";
import {
  createWorkoutMetadata,
  templateSelectionSeed,
  type WorkoutKind,
  type WorkoutLength,
  type WorkoutMetadata,
} from "./metadata";
import {
  reorderByWeakDomains,
  rankByRecency,
  type DomainRating,
  type PersonalizeOptions,
} from "./personalize";

/* ------------------------------------------------------------------ *
 * Lengths
 * ------------------------------------------------------------------ */

export interface WorkoutLengthSpec {
  id: WorkoutLength;
  /** Number of games in the workout. */
  gameCount: number;
  /** Player-facing label. */
  label: string;
}

/** Ordered shortest → longest; `standard` is the constitution default. */
export const WORKOUT_LENGTHS: readonly WorkoutLengthSpec[] = [
  { id: "short", gameCount: 2, label: "Short" },
  { id: "standard", gameCount: 4, label: "Standard" },
  { id: "extended", gameCount: 6, label: "Extended" },
];

export const DEFAULT_WORKOUT_LENGTH: WorkoutLength = "standard";

/** Spec for a length id (throws on unknown ids — programmer error). */
export function workoutLengthSpec(id: WorkoutLength): WorkoutLengthSpec {
  const spec = WORKOUT_LENGTHS.find((candidate) => candidate.id === id);
  if (!spec) {
    throw new Error(`Unknown workout length: ${id}`);
  }
  return spec;
}

/** Game count for a length variant. */
export function gameCountForLength(id: WorkoutLength): number {
  return workoutLengthSpec(id).gameCount;
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

/** A named, versioned workout structure. */
export interface WorkoutTemplate {
  /** Stable kebab-case id — never rename once instances reference it. */
  id: string;
  /** Player-facing name. */
  name: string;
  /** One-line player-facing description. */
  description: string;
  kind: WorkoutKind;
  /** Targeted domain, or null for the mixed daily workout. */
  focus: GameCategory | null;
  /** Length variants this template supports. */
  lengths: readonly WorkoutLength[];
}

/** Stable kebab-case slug for a category ('Logic & Problem Solving' → 'logic-problem-solving'). */
function categorySlug(category: GameCategory): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The default daily workout, described for history/UI parity with templates. */
export const DAILY_MIX_TEMPLATE: WorkoutTemplate = {
  id: "daily-mix",
  name: "Today's Workout",
  description: "The balanced daily mix across all domains.",
  kind: "daily",
  focus: null,
  lengths: ["standard"],
};

/**
 * Focus templates, one per browse category, generated deterministically from
 * `GAME_CATEGORIES` (registry-derived, not hand-maintained). Ids are stable:
 * `<category-slug>` prefixed with `focus-`.
 */
export function focusTemplates(): WorkoutTemplate[] {
  return GAME_CATEGORIES.map((category) => ({
    id: `focus-${categorySlug(category)}`,
    name: `${category} Focus`,
    description: `A targeted workout training ${category} games.`,
    kind: "template" as const,
    focus: category,
    lengths: ["short", "standard", "extended"] as const,
  }));
}

/** All templates (daily first, then the generated focus set). */
export function allWorkoutTemplates(): WorkoutTemplate[] {
  return [DAILY_MIX_TEMPLATE, ...focusTemplates()];
}

/** Look up a template by id, or null when unknown. */
export function getWorkoutTemplate(id: string): WorkoutTemplate | null {
  return allWorkoutTemplates().find((template) => template.id === id) ?? null;
}

/* ------------------------------------------------------------------ *
 * Selection
 * ------------------------------------------------------------------ */

export interface TemplateSelectionInput {
  /** Eligible catalog (callers pass the frozen-out filtered list). */
  games: readonly GameDefinition[];
  /** The template to instantiate (must be a player-startable one). */
  template: WorkoutTemplate;
  length: WorkoutLength;
  /** Local calendar date the instance belongs to. */
  date: string;
  /** Seeded alternative (reserved for future template rerolls). */
  attempt?: number;
  /** Game ids that must never appear (already-played positions). */
  exclude?: readonly string[];
}

export interface TemplateSelection {
  /** Ordered selected games (length ≤ requested game count). */
  games: GameDefinition[];
  /** Canonical seed the selection was drawn from. */
  seed: string;
  /** Versioned metadata describing the instance this selection produces. */
  metadata: WorkoutMetadata;
}

/**
 * Deterministically instantiate a TEMPLATE workout. The daily-mix template is
 * deliberately rejected here — its personalized selection lives in
 * `personalizedWorkout` and must stay the single code path for the default
 * workout (behavior-preservation constraint).
 *
 * Pool priority: primary-category matches → secondary-domain matches →
 * everything else (diverse fill). Within each tier the draw is rng-shuffled;
 * the final top-up uses the shared stratified `pickDiverse` from today.ts.
 */
export function selectTemplateWorkout(
  input: TemplateSelectionInput,
): TemplateSelection {
  const { games, template, length, date } = input;
  const attempt = input.attempt ?? 0;
  const excludeSet = new Set(input.exclude ?? []);
  if (template.kind !== "template" || template.focus === null) {
    throw new Error(
      `selectTemplateWorkout: "${template.id}" is not a startable template`,
    );
  }

  const count = Math.max(0, gameCountForLength(length));
  const eligible = games.filter((game) => !excludeSet.has(game.id));
  const seed = templateSelectionSeed(date, template.id, length, attempt);
  const rng = createRng(seed);
  const focus = template.focus;

  const primary = rng.shuffle(
    eligible.filter((game) => game.primaryCategory === focus),
  );
  const secondary = rng.shuffle(
    eligible.filter(
      (game) =>
        game.primaryCategory !== focus &&
        game.secondaryDomains?.includes(focus) === true,
    ),
  );

  const picked = [...primary, ...secondary].slice(0, count);
  if (picked.length < count) {
    // Short catalog: top up from the remaining eligible games so the workout
    // still fills every slot it can (mirrors today.ts's robustness rule).
    const taken = new Set(picked.map((game) => game.id));
    const rest = eligible.filter((game) => !taken.has(game.id));
    picked.push(...pickRest(rest, count - picked.length, rng));
  }

  return {
    games: picked,
    seed,
    metadata: createWorkoutMetadata({
      kind: "template",
      templateId: template.id,
      length,
      focus: template.focus,
    }),
  };
}

/** Deterministic top-up from the non-focus remainder (rng-shuffled slice). */
function pickRest(
  rest: readonly GameDefinition[],
  count: number,
  rng: Rng,
): GameDefinition[] {
  if (count <= 0) {
    return [];
  }
  return rng.shuffle([...rest]).slice(0, count);
}

export interface TemplatePersonalizationInput {
  domainRatings: readonly DomainRating[];
  recentGameIds: readonly string[];
  /** The selection's canonical seed ({@link TemplateSelection.seed}). */
  seed: string;
  options?: PersonalizeOptions;
}

/**
 * Reorder a template selection through the existing personalization seam
 * (read-only consumption of `@/workout/personalize`): recently played games
 * move to the tail, then weak domains surface first, then stale ones when
 * `options.nowMs` is provided. Members are never added or removed, so the
 * underlying seeded selection stays reproducible. Pure and deterministic.
 */
export function applyTemplatePersonalization(
  selection: readonly GameDefinition[],
  input: TemplatePersonalizationInput,
): GameDefinition[] {
  if (selection.length === 0) {
    return [];
  }
  // Independent stream keyed off the selection's own seed (the `::personalized`
  // suffix mirrors the daily layer's convention so the two never collide).
  const rng = createRng(`${input.seed}::personalized`);
  return reorderByWeakDomains(
    rankByRecency(selection, input.recentGameIds),
    input.domainRatings,
    rng,
    input.options ?? {},
  );
}
