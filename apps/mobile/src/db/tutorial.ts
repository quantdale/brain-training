/**
 * Tutorial persistence (006R task 5.1-5.2).
 *
 * Persistent tutorial state keyed by game ID. Implements the SDK's
 * `TutorialStore` interface for production use.
 */
import type { SQLiteAdapter } from './adapter';
import type { TutorialState } from '@/sdk/tutorial';

interface TutorialRow {
  game_id: string;
  completed: number; // 0 or 1
  replay_requested: number; // 0 or 1
  version: string | null;
  updated_at: number;
}

const SELECT_BY_GAME = 'SELECT game_id, completed, replay_requested, version, updated_at FROM tutorial_state WHERE game_id = ?';
const UPSERT = `
  INSERT INTO tutorial_state (game_id, completed, replay_requested, version, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (game_id) DO UPDATE SET
    completed = excluded.completed,
    replay_requested = excluded.replay_requested,
    version = excluded.version,
    updated_at = excluded.updated_at
`;

function mapRow(row: TutorialRow): TutorialState {
  return {
    completed: row.completed === 1,
    replayRequested: row.replay_requested === 1,
    version: row.version,
  };
}

export class TutorialRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Get tutorial state for a game, or null if never seen. */
  async getTutorialState(gameId: string): Promise<TutorialState | null> {
    const row = await this.adapter.get<TutorialRow>(SELECT_BY_GAME, [gameId]);
    return row ? mapRow(row) : null;
  }

  /** Set tutorial state for a game (upsert). */
  async setTutorialState(gameId: string, state: TutorialState): Promise<void> {
    const updatedAt = this.now();
    await this.adapter.run(UPSERT, [
      gameId,
      state.completed ? 1 : 0,
      state.replayRequested ? 1 : 0,
      state.version,
      updatedAt,
    ]);
  }
}
