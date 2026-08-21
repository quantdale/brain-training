import type { SQLiteAdapter } from './adapter';
import type { Profile } from './types';

/**
 * Singleton local profile (constitution §6: one persistent local profile per
 * device). The row is created on first access/launch and updated in place;
 * settings are stored as a JSON object and merged, never replaced wholesale.
 */

/** Fixed id of the singleton profile row. */
export const LOCAL_PROFILE_ID = 'local';

interface ProfileRow {
  id: string;
  display_name: string;
  settings_json: string;
  created_at: number;
  updated_at: number;
}

const SELECT_BY_ID = 'SELECT * FROM profile WHERE id = ?';
const INSERT_IF_ABSENT =
  'INSERT OR IGNORE INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)';
const UPDATE_ROW =
  'UPDATE profile SET display_name = ?, settings_json = ?, updated_at = ? WHERE id = ?';

function parseSettings(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    // Corrupt settings must not brick startup; fall back to defaults.
    return {};
  }
}

function mapRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    settings: parseSettings(row.settings_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProfileRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Create the singleton row if absent; returns the current profile. */
  async ensureExists(): Promise<Profile> {
    // One clock capture: created_at and updated_at must agree on insert even
    // if the injectable clock advances between the two reads.
    const now = this.now();
    await this.adapter.run(INSERT_IF_ABSENT, [LOCAL_PROFILE_ID, '', '{}', now, now]);
    const row = await this.adapter.get<ProfileRow>(SELECT_BY_ID, [LOCAL_PROFILE_ID]);
    if (!row) {
      throw new Error('profile row missing after ensureExists'); // unreachable
    }
    return mapRow(row);
  }

  /** Read the profile, or null before it has been created. `txn` reads inside a transaction (task 7.2). */
  async get(txn?: SQLiteAdapter): Promise<Profile | null> {
    const row = await (txn ?? this.adapter).get<ProfileRow>(SELECT_BY_ID, [LOCAL_PROFILE_ID]);
    return row ? mapRow(row) : null;
  }

  /**
   * Update display name and/or merge settings. Creates the row if absent.
   * The read-merge-write happens inside one transaction so concurrent updates
   * cannot clobber each other's settings. When `txn` is supplied the writes run
   * on that connection directly (no nested transaction — the adapter forbids
   * nesting); otherwise they are wrapped in `this.adapter.transaction`.
   */
  async update(
    updates: { displayName?: string; settings?: Record<string, unknown> } = {},
    txn?: SQLiteAdapter,
  ): Promise<Profile> {
    const write = async (a: SQLiteAdapter): Promise<Profile> => {
      await a.run(INSERT_IF_ABSENT, [LOCAL_PROFILE_ID, '', '{}', this.now(), this.now()]);
      const row = await a.get<ProfileRow>(SELECT_BY_ID, [LOCAL_PROFILE_ID]);
      if (!row) {
        throw new Error('profile row missing after upsert'); // unreachable
      }
      const settings = updates.settings
        ? { ...parseSettings(row.settings_json), ...updates.settings }
        : parseSettings(row.settings_json);
      const displayName = updates.displayName ?? row.display_name;
      const updatedAt = this.now();
      await a.run(UPDATE_ROW, [displayName, JSON.stringify(settings), updatedAt, LOCAL_PROFILE_ID]);
      return {
        id: LOCAL_PROFILE_ID,
        displayName,
        settings,
        createdAt: row.created_at,
        updatedAt,
      };
    };
    return txn ? write(txn) : this.adapter.transaction(write);
  }
}
