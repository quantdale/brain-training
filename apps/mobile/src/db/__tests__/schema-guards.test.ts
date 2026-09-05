/**
 * Startup schema-guard self-heal (campaign 021 whole-codebase audit).
 *
 * The replace-import/wipe paths DROP the append-only triggers at connection
 * level and recreate them in a `finally`. A process kill inside that window
 * used to leave the database permanently without its guards (no migration
 * would ever re-add them — the schema version never changed). `ensureSchemaGuards`
 * re-creates the derived canonical trigger set on every startup.
 */

import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { CANONICAL_TRIGGER_DDL } from '../schema';
import { ensureSchemaGuards } from '../migrate';
import { createMigratedDb } from './helpers';

async function triggerNames(db: SQLiteAdapter): Promise<Set<string>> {
  const rows = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'trigger'",
  );
  return new Set(rows.map((r) => r.name));
}

describe('ensureSchemaGuards', () => {
  it('derives the full canonical trigger set from the schema (no drift)', async () => {
    const db = await createMigratedDb();
    const migrated = await triggerNames(db);
    // Every trigger the migration chain creates is declared in SQL, so the
    // derived set must cover exactly the migrated set (same names, no extra).
    const derived = new Set(
      CANONICAL_TRIGGER_DDL.map((ddl) => /IF NOT EXISTS (\w+)/.exec(ddl)?.[1]),
    );
    expect([...migrated].sort()).toEqual([...derived].sort());
    expect(migrated.size).toBeGreaterThanOrEqual(15);
  });

  it('is a no-op on a healthy migrated database', async () => {
    const db = await createMigratedDb();
    const before = await triggerNames(db);
    await ensureSchemaGuards(db);
    expect(await triggerNames(db)).toEqual(before);
  });

  it('self-heals triggers lost in the drop/recreate crash window', async () => {
    const db = await createMigratedDb();
    // Simulate a kill between the DROP phase and the recreate: guards gone,
    // rows would be freely deletable.
    await db.exec('DROP TRIGGER trg_currency_ledger_no_delete');
    await db.exec('DROP TRIGGER trg_game_sessions_xp_check');
    await db.run('INSERT INTO currency_ledger (amount, reason, created_at) VALUES (10, ?, ?)', ['test', 1]);
    expect(
      await db.get<{ c: number }>(
        'SELECT COUNT(*) AS c FROM sqlite_master WHERE type = ? AND name = ?',
        ['trigger', 'trg_currency_ledger_no_delete'],
      ),
    ).toEqual({ c: 0 });
    await db.exec('DELETE FROM currency_ledger'); // unguarded — proves the window

    await ensureSchemaGuards(db);

    const after = await triggerNames(db);
    expect(after.has('trg_currency_ledger_no_delete')).toBe(true);
    expect(after.has('trg_game_sessions_xp_check')).toBe(true);
    // And the restored guards actually enforce:
    await db.run('INSERT INTO currency_ledger (amount, reason, created_at) VALUES (10, ?, ?)', ['test', 1]);
    await expect(db.exec('DELETE FROM currency_ledger')).rejects.toThrow(/append-only/);
  });

  it('extracts CASE-style CHECK triggers completely (no truncation at CASE END)', async () => {
    const check = CANONICAL_TRIGGER_DDL.find((d) => d.includes('trg_game_sessions_xp_check'));
    expect(check).toBeDefined();
    // The statement must terminate at the TRIGGER's own END, i.e. include the
    // inner CASE's `END;` AND the trigger-closing `END;` — a truncated
    // extraction would stop after the first one.
    expect(check).toMatch(/CASE[\s\S]+END;[\s\S]+END;$/);
    expect((check!.match(/END;/g) ?? []).length).toBe(2);
});
});
