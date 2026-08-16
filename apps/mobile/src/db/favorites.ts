import type { SQLiteAdapter } from './adapter';

/**
 * Game favorites (constitution §21: discovery supports favorites). One row
 * per favorited game id; the created timestamp enables ordering by recency.
 */

const INSERT =
  'INSERT OR IGNORE INTO game_favorites (game_id, created_at) VALUES (?, ?)';
const DELETE = 'DELETE FROM game_favorites WHERE game_id = ?';
const SELECT_ONE = 'SELECT game_id FROM game_favorites WHERE game_id = ?';
const SELECT_ALL = 'SELECT game_id, created_at FROM game_favorites ORDER BY created_at DESC';

interface FavoriteRow {
  game_id: string;
  created_at: number;
}

export class FavoritesRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Mark a game as favorite (no-op when already favorite). */
  async setFavorite(gameId: string): Promise<void> {
    await this.adapter.run(INSERT, [gameId, this.now()]);
  }

  /** Remove a game from favorites (no-op when not favorited). */
  async removeFavorite(gameId: string): Promise<void> {
    await this.adapter.run(DELETE, [gameId]);
  }

  /** Whether the game is favorited. */
  async isFavorite(gameId: string): Promise<boolean> {
    const row = await this.adapter.get<FavoriteRow>(SELECT_ONE, [gameId]);
    return row !== null;
  }

  /** Favorited game ids, most recently favorited first. */
  async listFavoriteGameIds(): Promise<string[]> {
    const rows = await this.adapter.all<FavoriteRow>(SELECT_ALL);
    return rows.map((r) => r.game_id);
  }
}
