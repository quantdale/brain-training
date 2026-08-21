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

/** Per-statement variable budget for the bulk membership check. */
const FAVORITE_IN_CHUNK = 500;

interface FavoriteRow {
  game_id: string;
  created_at: number;
}

/** Full favorite row: game id plus when it was favorited (epoch ms). */
export interface FavoriteEntry {
  gameId: string;
  createdAt: number;
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

  /**
   * Batch variant of `setFavorite` (campaign 010 W11): marks every id in one
   * transaction with a single shared timestamp, so a batch can never end up
   * half-applied. Idempotent per id (`INSERT OR IGNORE`); duplicates in the
   * input collapse.
   */
  async setFavorites(gameIds: readonly string[]): Promise<void> {
    const unique = [...new Set(gameIds)];
    if (unique.length === 0) {
      return;
    }
    const createdAt = this.now(); // one clock capture for the whole batch
    await this.adapter.transaction(async (txn) => {
      for (const gameId of unique) {
        await txn.run(INSERT, [gameId, createdAt]);
      }
    });
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

  /** Full favorite rows (id + timestamp), most recently favorited first. */
  async listFavorites(): Promise<FavoriteEntry[]> {
    const rows = await this.adapter.all<FavoriteRow>(SELECT_ALL);
    return rows.map((r) => ({ gameId: r.game_id, createdAt: r.created_at }));
  }

  /**
   * Bulk membership check (campaign 010 W11): which of the given ids are
   * favorited, returned in the caller's order. One chunked `IN` query per
   * ~500 ids instead of one query per id.
   */
  async areFavorites(gameIds: readonly string[]): Promise<string[]> {
    const unique = [...new Set(gameIds)];
    if (unique.length === 0) {
      return [];
    }
    const found = new Set<string>();
    for (let i = 0; i < unique.length; i += FAVORITE_IN_CHUNK) {
      const chunkIds = unique.slice(i, i + FAVORITE_IN_CHUNK);
      const rows = await this.adapter.all<FavoriteRow>(
        `SELECT game_id FROM game_favorites WHERE game_id IN (${chunkIds.map(() => '?').join(',')})`,
        chunkIds,
      );
      for (const row of rows) {
        found.add(row.game_id);
      }
    }
    return unique.filter((id) => found.has(id));
  }
}
