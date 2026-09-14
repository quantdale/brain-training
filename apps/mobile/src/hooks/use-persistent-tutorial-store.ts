/**
 * Production tutorial-store hydration (frontier audit `persistent-game-tutorials`).
 *
 * The SDK `TutorialStore` is synchronous while `TutorialRepository` is async,
 * so the game route hydrates a `createWriteThroughTutorialStore` from the
 * persisted row BEFORE mounting the game screen. Returning `null` until the row
 * has been read lets the route hold the loading fallback, so a completed
 * tutorial can never flash and then disappear.
 *
 * When the database is unavailable (isolated tests, previews) the hook degrades
 * to the process-local in-memory store instead of crashing gameplay.
 */
import { useEffect, useState } from 'react';

import { getDb } from '@/db';
import {
  createInMemoryTutorialStore,
  createWriteThroughTutorialStore,
  type TutorialStore,
} from '@/sdk';

interface HydratedTutorialStore {
  gameId: string;
  store: TutorialStore;
}

export function usePersistentTutorialStore(
  gameId: string | undefined,
): TutorialStore | null {
  const [hydrated, setHydrated] = useState<HydratedTutorialStore | null>(null);

  useEffect(() => {
    if (gameId === undefined) {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      let store: TutorialStore;
      try {
        const db = getDb();
        const persisted = await db.tutorials.getTutorialState(gameId);
        if (cancelled) {
          return;
        }
        store = createWriteThroughTutorialStore({
          initial: persisted === null ? {} : { [gameId]: persisted },
          persist: (id, state) => getDb().tutorials.setTutorialState(id, state),
          onPersistError: (id, error) => {
            // The in-session state stays as the player saw it; the next cold
            // start will re-show the tutorial if the write never landed.
            console.error(
              JSON.stringify({
                level: 'error',
                component: 'tutorial-store',
                gameId: id,
                message: error instanceof Error ? error.message : String(error),
              }),
            );
          },
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error(
          '[tutorial] hydration failed; falling back to a process-local store',
          error,
        );
        store = createInMemoryTutorialStore();
      }
      setHydrated({ gameId, store });
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  // A stale hydration for a previous game id must not leak into the new game.
  return hydrated !== null && hydrated.gameId === gameId ? hydrated.store : null;
}
