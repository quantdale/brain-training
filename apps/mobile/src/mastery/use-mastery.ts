/**
 * Mastery data seam (Campaign 014 W2/W6): one bounded pushdown per load,
 * mapped through the pure tier engine into a per-game summary map. Games
 * without sessions synthesize the `unplayed` evidence row so every catalog id
 * always resolves. Reloads on screen focus (post-session completions change
 * tiers) and via the manual `reload`.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { registry } from "@/registry/registry.generated";
import {
  computeMastery,
  type MasteryInput,
  type MasterySummary,
} from "./engine";

export interface UseMasterySummariesResult {
  ready: boolean;
  /** Tier summary for every registered game id. */
  byGame: Map<string, MasterySummary>;
  /** Re-read on demand (e.g. right after a forced completion). */
  reload: () => void;
}

function summarize(inputs: MasteryInput[]): Map<string, MasterySummary> {
  const byId = new Map(inputs.map((row) => [row.gameId, row]));
  const out = new Map<string, MasterySummary>();
  for (const game of registry) {
    const input = byId.get(game.id);
    out.set(
      game.id,
      computeMastery(
        input ?? {
          gameId: game.id,
          sessions: 0,
          bestNormalized: 0,
          avgNormalized: 0,
          hardStrong: 0,
          expertStrong: 0,
          lastCompletedAt: 0,
        },
      ),
    );
  }
  return out;
}

const EMPTY_MAP = new Map<string, MasterySummary>();

async function loadMastery(): Promise<Map<string, MasterySummary>> {
  const inputs = await getDb().sessions.getMasteryInputs(Date.now());
  return summarize(inputs);
}

export function useMasterySummaries(): UseMasterySummariesResult {
  const [token, setToken] = useState(0);
  const reload = useCallback(() => setToken((t) => t + 1), []);
  // Every focus bumps the token so the map reflects sessions completed
  // elsewhere; the throw-safe hook degrades to the empty map without storage.
  useFocusEffect(useCallback(() => setToken((t) => t + 1), []));
  const { data: byGame, loaded } = useDbData(loadMastery, [token], EMPTY_MAP);
  return { ready: loaded, byGame, reload };
}
