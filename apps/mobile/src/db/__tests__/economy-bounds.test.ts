import { expect, it } from '@jest/globals';
import { applyImport, parseAndValidateBackup, serializeBackup } from '@/data-portability';
import { buildEnvelope, emptyData, makeDb, T0 } from '@/data-portability/__tests__/helpers';

const MAX = Number.MAX_SAFE_INTEGER;
const session = (id: string, xp: number) => ({
  id, gameId: 'memory', gameVersion: 1, generatorVersion: 1, scoringVersion: 1,
  seed: 1, difficulty: {}, rawResult: {}, normalizedResult: 0.5, xp,
  startedAt: T0, completedAt: T0 + 100, durationMs: 100,
});
async function imported(kind: 'ledger' | 'award' | 'session', amount = MAX) {
  const db = await makeDb();
  const data = emptyData();
  if (kind === 'ledger') data.currencyLedger = [{ amount, reason: 'audit', sessionId: null, createdAt: T0, operationId: 'original' }];
  if (kind === 'award') data.xpAwards = [{ amount, reason: 'bonus', source: 'system', createdAt: T0 }];
  if (kind === 'session') data.gameSessions = [session('original', amount)];
  await applyImport(db, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'replace');
  return db;
}

it('refuses a ledger append above the exact balance limit without inserting', async () => {
  const db = await imported('ledger');
  const before = await db.ledger.list();
  await expect(db.ledger.append({ amount: 1, reason: 'new', operationId: 'new' })).rejects.toThrow(/safe|overflow/i);
  expect(await db.ledger.list()).toEqual(before);
  expect(await db.ledger.getBalance()).toBe(MAX);
  // An already committed operation still replays successfully at the ceiling.
  await expect(db.ledger.append({ amount: 1, reason: 'retry', operationId: 'original' })).resolves.toEqual(before[0]);
});

it.each(['award', 'session'] as const)('bounds new awards against combined XP after imported %s XP', async (kind) => {
  const db = await imported(kind);
  const before = await db.xpAwards.list();
  await expect(db.xpAwards.award(1, 'new', 'system')).rejects.toThrow(/safe|overflow/i);
  expect(await db.xpAwards.list()).toEqual(before);
  expect((await db.sessions.getTotalXp()) + (await db.xpAwards.getTotalAwardedXp())).toBe(MAX);
});

it('rejects a single unsafe XP award before persisting it', async () => {
  const db = await makeDb();
  await expect(db.xpAwards.award(MAX + 1, 'unsafe', 'system')).rejects.toThrow(/safe|integer/i);
  expect(await db.xpAwards.list()).toEqual([]);
});

it.each(['award', 'session'] as const)('rolls back all completion side effects above combined %s XP', async (kind) => {
  const db = await imported(kind);
  const profile = await db.profile.get();
  const count = await db.sessions.getCount();
  await expect(db.sessions.completeSession({ session: session('new', 1), currency: { amount: 1, reason: 'gameplay' } })).rejects.toThrow(/safe|overflow/i);
  expect(await db.sessions.getCount()).toBe(count);
  expect(await db.ledger.list()).toEqual([]);
  expect(await db.profile.get()).toEqual(profile);
  expect((await db.sessions.getTotalXp()) + (await db.xpAwards.getTotalAwardedXp())).toBe(MAX);
});

it('rolls back session XP and profile changes when gameplay currency overflows', async () => {
  const db = await imported('ledger');
  const before = await db.ledger.list();
  const profile = await db.profile.get();
  await expect(db.sessions.completeSession({ session: session('new', 1), currency: { amount: 1, reason: 'gameplay' } })).rejects.toThrow(/safe|overflow/i);
  expect(await db.sessions.getCount()).toBe(0);
  expect(await db.ledger.list()).toEqual(before);
  expect(await db.profile.get()).toEqual(profile);
});

it('atomically admits two concurrent ordinary award writes up to the exact ceiling', async () => {
  const db = await imported('award', MAX - 2);
  await expect(Promise.all([db.xpAwards.award(1, 'one', 'system'), db.xpAwards.award(1, 'two', 'system')])).resolves.toHaveLength(2);
  expect(await db.xpAwards.getTotalAwardedXp()).toBe(MAX);
  await expect(db.xpAwards.award(1, 'three', 'system')).rejects.toThrow(/safe|overflow/i);
});

it('admits a session at the ceiling and preserves successful duplicate completion', async () => {
  const db = await imported('session', MAX - 1);
  const input = { session: session('last', 1), currency: { amount: 1, reason: 'gameplay' } };
  const first = await db.sessions.completeSession(input);
  const replay = await db.sessions.completeSession(input);
  expect(replay.session).toEqual(first.session);
  expect(replay.ledgerEntry).toBeNull();
  expect(await db.sessions.getTotalXp()).toBe(MAX);
  expect(await db.ledger.getBalance()).toBe(1);
});
