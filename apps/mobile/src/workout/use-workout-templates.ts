/**
 * `useWorkoutTemplates` — engine hook for template workouts (Workout V2).
 *
 * Exposes everything a screen needs to present and run NON-daily workouts
 * without knowing the storage/selection internals:
 *
 * - `templates` — the full catalog (daily mix first, then one focus template
 *   per browse category, generated from `GAME_CATEGORIES`);
 * - `suggestions` — today's deterministic rotation menu (`rotation.ts`),
 *   with templates already started today skipped;
 * - `history` — recent completion summaries across ALL workout kinds (daily +
 *   templates) for history UIs;
 * - `startTemplate` — idempotent start/resume: the same
 *   `(date, templateId, length)` maps to ONE persisted instance, so starting
 *   an already-started workout resumes it instead of duplicating.
 *
 * The default daily workout keeps its own hook (`useWorkout`) and behavior —
 * this hook never touches the daily row. Like `useWorkout`, it is router-free
 * (callers wire focus/refresh) and re-reads when any workout changes via the
 * shared event bus.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutInstance } from "@/db";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { emitWorkoutChanged, onWorkoutChanged } from "./events";
import {
  WORKOUT_SELECTION_SEED_VERSION,
  parseInstanceKey,
  templateInstanceKey,
  type WorkoutLength,
} from "./metadata";
import type { DomainRating } from "./personalize";
import { eligibleGameIds, eligibleGames } from "./reconcile";
import { localDateString } from "./today";
import { rotationSuggestions } from "./rotation";
import {
  allWorkoutTemplates,
  applyTemplatePersonalization,
  getWorkoutTemplate,
  selectTemplateWorkout,
} from "./templates";
import type { WorkoutCompletionSummary } from "./summary";

/** How many history summaries the hook materializes for screens. */
const HISTORY_LIMIT = 14;

export interface UseWorkoutTemplatesArgs {
  /** Current domain ratings (personalization seam input; may be empty). */
  domainRatings: DomainRating[];
  /** Recently played game ids, newest first (may be empty). */
  recentGameIds: string[];
}

export interface UseWorkoutTemplatesResult {
  ready: boolean;
  /** Full template catalog (daily-mix first). */
  templates: ReturnType<typeof allWorkoutTemplates>;
  /** Today's rotation menu, minus templates already started today. */
  suggestions: ReturnType<typeof rotationSuggestions>;
  /** Recent summaries across daily + template workouts, newest first. */
  history: WorkoutCompletionSummary[];
  /**
   * Start (or resume) a template workout. Resolves to the persisted instance,
   * or null when the template id is unknown / the db is unavailable.
   */
  startTemplate: (
    templateId: string,
    length: WorkoutLength,
  ) => Promise<WorkoutInstance | null>;
  /** Re-read history + suggestions (call when the screen regains focus). */
  refresh: () => void;
}

export function useWorkoutTemplates(
  args: UseWorkoutTemplatesArgs,
): UseWorkoutTemplatesResult {
  const date = localDateString();

  // Latest args without retriggering loads on every render (same pattern as
  // useWorkout: callers may pass fresh array literals each render).
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  }, [args]);

  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  // Re-read when another screen changes any workout (e.g. the result screen
  // advances an instance). Router-free + synchronous, mirroring useWorkout.
  useEffect(() => onWorkoutChanged(refresh), [refresh]);

  const { data: history, loaded: historyLoaded } = useDbData(
    async (db) => {
      // Resume/reconciliation hardening across template types: repair every
      // recent ACTIVE instance (daily + templates) against the current
      // eligible catalog before reading history (completed rows are
      // historical records and are intentionally left untouched).
      await db.workouts.reconcileActiveInstances(eligibleGameIds());
      return db.workouts.listRecentSummaries(HISTORY_LIMIT);
    },
    [date, reloadToken],
    [] as WorkoutCompletionSummary[],
  );

  /** Template ids already started (active or completed) today. */
  const startedToday = useMemo(() => {
    const ids = new Set<string>();
    for (const summary of history) {
      if (summary.date !== date) {
        continue;
      }
      const parsed = parseInstanceKey(summary.key);
      if (parsed.kind === "template" && parsed.templateId) {
        ids.add(parsed.templateId);
      }
    }
    return ids;
  }, [history, date]);

  const suggestions = useMemo(
    () => rotationSuggestions(date, { skipTemplateIds: [...startedToday] }),
    [date, startedToday],
  );

  const startTemplate = useCallback(
    async (templateId: string, length: WorkoutLength): Promise<WorkoutInstance | null> => {
      const template = getWorkoutTemplate(templateId);
      // The daily mix has its own hook/path; only player-startable templates
      // go through here.
      if (!template || template.kind !== "template") {
        return null;
      }
      let db;
      try {
        db = getDb();
      } catch {
        return null;
      }
      const { domainRatings, recentGameIds } = argsRef.current;
      const selection = selectTemplateWorkout({
        games: eligibleGames(),
        template,
        length,
        date,
      });
      // Personalization reorders through the existing seam (read-only); the
      // seeded member set stays reproducible regardless of the inputs.
      const ordered = applyTemplatePersonalization(selection.games, {
        domainRatings,
        recentGameIds,
        seed: selection.seed,
        options: { nowMs: Date.now() },
      });
      const key = templateInstanceKey(date, template.id, length);
      const instance = await db.workouts.getOrCreate(
        key,
        {
          gameIds: ordered.map((game) => game.id),
          seedVersion: WORKOUT_SELECTION_SEED_VERSION,
        },
        {
          ...selection.metadata,
          inputs: {
            domainRatings: Object.fromEntries(
              domainRatings.map((entry) => [entry.domain, entry.rating]),
            ),
            recentGameIds: [...recentGameIds],
            seed: selection.seed,
          },
        },
      );
      emitWorkoutChanged();
      refresh();
      return instance;
    },
    [date, refresh],
  );

  return {
    ready: historyLoaded,
    templates: useMemo(() => allWorkoutTemplates(), []),
    suggestions,
    history,
    startTemplate,
    refresh,
  };
}
