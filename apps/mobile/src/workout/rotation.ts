/**
 * Workout Engine V2 — rotation strategy across days/templates.
 *
 * The daily mix already rotates games; this module rotates the TEMPLATE
 * dimension: each local calendar date deterministically suggests one focus
 * domain ("today's focus"), walking a fixed seeded rotation so consecutive
 * days train different domains and the full cycle repeats every
 * `GAME_CATEGORIES.length` days. Everything is derived from the date string,
 * so callers inject time by passing `localDateString(clock())` — no wall
 * clock is read here (injectable-clock rule).
 *
 * `rotationSuggestions` turns the single suggestion into an ordered menu:
 * today's rotation slot first, then the rest of the cycle in rotation order
 * (skipping templates the caller excludes, e.g. ones already started today),
 * with the daily mix appended last as the ever-available fallback.
 */

import { createRng } from "@/sdk";
import {
  DAILY_MIX_TEMPLATE,
  focusTemplates,
  type WorkoutTemplate,
} from "./templates";

/** Seed of the fixed rotation order — bump to reshuffle the cycle globally. */
const ROTATION_SEED = "workout-template-rotation::v1";

/**
 * Fixed rotation order over the generated focus templates. Computed once per
 * process from a constant seed, so every install walks the same cycle and a
 * given date always maps to the same focus template.
 */
const ROTATION_ORDER: readonly string[] = createRng(
  ROTATION_SEED,
).shuffle(focusTemplates().map((template) => template.id));

/**
 * Whole days between the workout-chain base (`WORKOUT_CHAIN_BASE` in
 * `./today`, currently 2026-01-01) and `date` (negative before the base).
 * Dates are validated-format YYYY-MM-DD strings produced by
 * `localDateString`; malformed input yields NaN and falls back to slot 0.
 */
export function dayIndexFromBase(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return 0;
  }
  const ms =
    Date.UTC(year, month - 1, day) - Date.UTC(2026, 0, 1);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Today's rotated focus template for a local calendar date. */
export function rotatedTemplateForDate(date: string): WorkoutTemplate {
  const templates = focusTemplates();
  const byId = new Map(templates.map((template) => [template.id, template]));
  const index = ((dayIndexFromBase(date) % ROTATION_ORDER.length) +
    ROTATION_ORDER.length) %
    ROTATION_ORDER.length;
  const id = ROTATION_ORDER[index] ?? templates[0]?.id ?? "";
  return byId.get(id) ?? DAILY_MIX_TEMPLATE;
}

export interface RotationSuggestionOptions {
  /** Template ids to skip (e.g. already started/completed today). */
  skipTemplateIds?: readonly string[];
}

/**
 * Ordered template menu for a date: the rotated focus slot first, then the
 * remaining rotation cycle in order (minus skipped ids), then the daily mix
 * last. Deterministic — same inputs always yield the same menu.
 */
export function rotationSuggestions(
  date: string,
  options: RotationSuggestionOptions = {},
): WorkoutTemplate[] {
  const skip = new Set(options.skipTemplateIds ?? []);
  const templates = focusTemplates();
  const byId = new Map(templates.map((template) => [template.id, template]));

  const start = ((dayIndexFromBase(date) % ROTATION_ORDER.length) +
    ROTATION_ORDER.length) %
    ROTATION_ORDER.length;
  const ordered: WorkoutTemplate[] = [];
  for (let step = 0; step < ROTATION_ORDER.length; step += 1) {
    const id = ROTATION_ORDER[(start + step) % ROTATION_ORDER.length];
    const template = id === undefined ? undefined : byId.get(id);
    if (template && !skip.has(template.id)) {
      ordered.push(template);
    }
  }
  if (!skip.has(DAILY_MIX_TEMPLATE.id)) {
    ordered.push(DAILY_MIX_TEMPLATE);
  }
  return ordered;
}
