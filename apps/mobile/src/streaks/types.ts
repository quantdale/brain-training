/**
 * Streak model types (campaign 003, WP-3B, constitution §18).
 *
 * The streak is reconstructed purely from activity history (session
 * `completedAt` local dates); item counts live in the profile `settings_json`
 * under the namespaced `streaks` key. See `reconstruct.ts` for the raw
 * reconstruction semantics and `rules.ts` for the Freeze/Recovery transforms.
 */

/** Raw/effective streak numbers for one point in time. */
export interface StreakState {
  /**
   * Length of the consecutive run ending at `lastActiveDate`. When the last
   * active day is today the streak is alive; when it is exactly yesterday the
   * streak is still alive and `atRisk` is true; when it is older the streak
   * has BROKEN — `current` still carries the broken run so Recovery can
   * restore it. For the display number (0 once broken) use
   * `effectiveCurrent(state, today)` from `reconstruct.ts`.
   */
  current: number;
  /** Longest consecutive run anywhere in the activity history. */
  longest: number;
  /**
   * Most recent day counted in the streak (`YYYY-MM-DD`): the last day with
   * recorded activity, advanced to the covered day by the Freeze/Recovery
   * transforms. `null` when there is no activity history at all.
   */
  lastActiveDate: string | null;
  /**
   * True when the last active day is exactly yesterday and there is no
   * activity today yet: the streak is still alive but one more missed day
   * breaks it. This is the only window in which a Freeze can be applied
   * (see `canApplyFreeze`).
   */
  atRisk: boolean;
  /**
   * Days in the current streak covered by protection (Freeze or Recovery).
   * Raw reconstruction always reports 0 — only the transforms in `rules.ts`
   * maintain it, because raw activity history cannot see item usage.
   */
  frozenDays: number;
}

/** Purchasable protection/recovery item kinds (constitution §18). */
export type StreakItemKind = 'freeze' | 'shield' | 'recovery';

/** Item counts owned by the player. */
export interface StreakInventory {
  freeze: number;
  shield: number;
  recovery: number;
}

/**
 * Monthly Freeze usage counter, persisted inside settings as
 * `streaks.freezeUsed`, keyed by calendar month `YYYY-MM` (see
 * `streakPeriodKey`).
 */
export interface StreakFreezeUsage {
  period: string;
  count: number;
}

/**
 * Shape persisted under `settings.streaks` in the profile `settings_json`
 * (merged by `db.profile.update`, never replaced wholesale). `freezeUsed` is
 * optional — absent means no Freezes used this period. Readers must treat the
 * block tolerantly (missing/garbage → zeros); see `readInventory`.
 */
export interface StreakSettings {
  freeze: number;
  shield: number;
  recovery: number;
  freezeUsed?: StreakFreezeUsage;
}
