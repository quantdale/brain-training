/**
 * Quest refresh semantics (engagement V2, campaign 010 / W12).
 *
 * Daily/weekly quests "refresh" by period key: a new local day (or ISO week)
 * starts fresh progress rows, so the active set rotates deterministically
 * (`selectActiveQuests`). This module answers the UI question the rotation
 * itself cannot: WHEN does the current set rotate next. Pure — no db access,
 * injectable clock date.
 */
import type { QuestKind } from './types';

/** The next instant the quest set for `kind` rotates, in LOCAL time. */
export function nextRefreshAt(kind: QuestKind, now: Date): Date | null {
  switch (kind) {
    case 'daily':
      return nextLocalMidnight(now);
    case 'weekly':
      return nextIsoWeekStart(now);
    case 'longterm':
      // Long-term quests never rotate.
      return null;
  }
}

/** Milliseconds until `kind`'s set rotates (null = never). */
export function msUntilRefresh(kind: QuestKind, now: Date): number | null {
  const at = nextRefreshAt(kind, now);
  return at === null ? null : Math.max(0, at.getTime() - now.getTime());
}

/**
 * Next local midnight strictly after `now` (so `now` exactly at midnight
 * rolls to the NEXT day's midnight — a refresh is always in the future).
 */
function nextLocalMidnight(now: Date): Date {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  if (midnight.getTime() <= now.getTime()) {
    midnight.setDate(midnight.getDate() + 1);
  }
  return midnight;
}

/**
 * Start (local Monday 00:00) of the ISO week AFTER the one containing `now`.
 * Mirrors `isoWeekOf`'s Monday-based week convention.
 */
function nextIsoWeekStart(now: Date): Date {
  const day = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1 .. Sun=7
  const daysUntilNextMonday = 8 - day; // e.g. Mon(1) -> 7, Sun(7) -> 1
  const nextMonday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysUntilNextMonday,
    0,
    0,
    0,
    0,
  );
  if (nextMonday.getTime() <= now.getTime()) {
    nextMonday.setDate(nextMonday.getDate() + 7);
  }
  return nextMonday;
}
