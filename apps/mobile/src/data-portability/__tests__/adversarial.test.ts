/**
 * Adversarial tests for the local data-portability engine (task C).
 *
 * These attack the versioned, checksummed envelope with corrupted, malformed,
 * duplicate, future, empty, huge, and reordered backups, plus the critical
 * data-integrity guarantees:
 *
 *   - a corrupted/missing checksum or malformed envelope is always rejected;
 *   - a newer-than-supported format version is rejected (never silently read);
 *   - a backup missing a required section is rejected (shape-validated);
 *   - duplicate ids / operations / sessions collapse safely (no crash, no
 *     double-write, no unique-index violation on replace);
 *   - merge and replace are both idempotent across repeated restores;
 *   - imported timestamps are preserved (never overwritten by the clock);
 *   - old (imported) schema versions are accepted (schemaVersion is
 *     informational, never a blocker);
 *   - import is order-independent (record order in the text does not matter);
 *   - preview counters exactly match the real apply counters.
 */

import { describe, expect, it } from "@jest/globals";
import {
  applyImport,
  exportLocalData,
  serializeBackup,
  parseAndValidateBackup,
  previewImport,
  wipeLocalData,
  countLocalData,
  computeChecksum,
  canonicalString,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  ChecksumMismatchError,
  MalformedBackupError,
  UnsupportedVersionError,
  type BackupData,
  type BackupEnvelope,
  type ImportMode,
} from "../index";
import { AppDatabase } from "@/db";
import { makeDb, seedFixture, T0 } from "./helpers";

/** Build a fully-checksummed envelope from raw `data`. */
function buildEnvelope(
  data: BackupData,
  opts: { version?: number; schemaVersion?: number; createdAt?: number } = {},
): BackupEnvelope {
  const withoutChecksum: Omit<BackupEnvelope, "checksum"> = {
    format: BACKUP_FORMAT,
    version: opts.version ?? BACKUP_FORMAT_VERSION,
    createdAt: opts.createdAt ?? T0 + 1,
    schemaVersion: opts.schemaVersion ?? 7,
    checksumAlgorithm: "sha256",
    data,
  };
  const checksum = computeChecksum(
    canonicalString(withoutChecksum as unknown as Record<string, unknown>),
  );
  return { ...withoutChecksum, checksum };
}

/** A minimal but valid data snapshot (empty everything). */
function emptyData(): BackupData {
  return {
    schemaVersion: 7,
    profile: null,
    gameSessions: [],
    domainRatings: [],
    ratingHistory: [],
    currencyLedger: [],
    gameFavorites: [],
    xpAwards: [],
    tutorialState: [],
    workoutInstances: [],
    questDefinitions: [],
    questProgress: [],
    achievementDefinitions: [],
    achievementUnlocks: [],
  };
}

/** Seeded data snapshot taken from a fully-seeded database. */
async function seededData(): Promise<BackupData> {
  const src = await makeDb();
  await seedFixture(src);
  const env = await exportLocalData(src, { now: () => T0 + 1 });
  return env.data;
}

describe("rejection gates (corruption / malformation)", () => {
  it("rejects a backup with a corrupted checksum", () => {
    const env = buildEnvelope(emptyData());
    const text = serializeBackup(env).replace(
      env.checksum.slice(0, 8),
      "deadbeef",
    );
    expect(() => parseAndValidateBackup(text)).toThrow(ChecksumMismatchError);
  });

  it("rejects a backup missing its checksum", () => {
    const env = buildEnvelope(emptyData());
    const { checksum: _drop, ...payload } = env as unknown as Record<
      string,
      unknown
    >;
    void _drop;
    expect(() => parseAndValidateBackup(JSON.stringify(payload))).toThrow(
      MalformedBackupError,
    );
  });

  it("rejects non-JSON garbage", () => {
    expect(() => parseAndValidateBackup("not json at all {{{")).toThrow(
      MalformedBackupError,
    );
  });

  it("rejects a JSON value that is not an object", () => {
    expect(() => parseAndValidateBackup("[1,2,3]")).toThrow(
      MalformedBackupError,
    );
  });

  it("rejects an unrecognized format", () => {
    const env = buildEnvelope(emptyData());
    const text = serializeBackup(env).replace(
      BACKUP_FORMAT,
      "some-other-backup",
    );
    expect(() => parseAndValidateBackup(text)).toThrow(MalformedBackupError);
  });

  it("rejects a non-numeric version", () => {
    const env = buildEnvelope(emptyData());
    const text = serializeBackup({
      ...env,
      version: "one" as unknown as number,
    });
    expect(() => parseAndValidateBackup(text)).toThrow(MalformedBackupError);
  });

  it("rejects a future format version", () => {
    const env = buildEnvelope(emptyData(), {
      version: BACKUP_FORMAT_VERSION + 1,
    });
    expect(() => parseAndValidateBackup(serializeBackup(env))).toThrow(
      UnsupportedVersionError,
    );
  });

  it("rejects a backup missing a required data section", () => {
    const data = emptyData();
    const { gameSessions: _drop, ...rest } = data as unknown as Record<
      string,
      unknown
    >;
    void _drop;
    const env = buildEnvelope(rest as unknown as BackupData);
    // Missing `gameSessions` must fail shape validation, not silently default.
    expect(() => parseAndValidateBackup(serializeBackup(env))).toThrow(
      /validation/i,
    );
  });

  it("rejects a backup whose section is the wrong type", () => {
    const data = emptyData();
    const bad = {
      ...data,
      gameSessions: "not-an-array",
    } as unknown as BackupData;
    const env = buildEnvelope(bad);
    expect(() => parseAndValidateBackup(serializeBackup(env))).toThrow(
      /validation/i,
    );
  });
});

describe("duplicate / conflicting records collapse safely (no crash, no double-write)", () => {
  it("collapses duplicate session ids within a backup", async () => {
    const data = await seededData();
    const dup = { ...data.gameSessions[0], xp: 999 };
    const withDup = { ...data, gameSessions: [...data.gameSessions, dup] };
    const env = buildEnvelope(withDup);

    const target = await makeDb();
    const res = await applyImport(
      target,
      parseAndValidateBackup(serializeBackup(env)),
      "replace",
    );
    // Deduped by id -> only the original count is written once.
    expect(res.sessionsAdded).toBe(2);
    expect(await target.sessions.listRecent(10000)).toHaveLength(
      2,
    );
  });

  it("collapses duplicate ledger operation_ids within a backup", async () => {
    const data = await seededData();
    const op = data.currencyLedger[0].operationId;
    const clone = { ...data.currencyLedger[0] };
    const withDup = {
      ...data,
      currencyLedger: op
        ? [...data.currencyLedger, clone]
        : data.currencyLedger,
    };
    const env = buildEnvelope(withDup);

    const target = await makeDb();
    const res = await applyImport(
      target,
      parseAndValidateBackup(serializeBackup(env)),
      "replace",
    );
    expect(res.ledgerAdded).toBe(data.currencyLedger.length);
    expect(await target.ledger.list(10000)).toHaveLength(
      data.currencyLedger.length,
    );
  });

  it("takes the first rating on conflicting domain-rating records", async () => {
    const data = await seededData();
    const original = data.domainRatings.find((d) => d.domain === "Memory")!;
    const conflict = { ...original, rating: original.rating + 500 };
    const withConflict = {
      ...data,
      domainRatings: [...data.domainRatings, conflict],
    };
    const env = buildEnvelope(withConflict);

    const target = await makeDb();
    await applyImport(
      target,
      parseAndValidateBackup(serializeBackup(env)),
      "replace",
    );
    const rating = (await target.ratings.getRatings()).find(
      (r) => r.domain === "Memory",
    )!;
    expect(rating.rating).toBe(original.rating);
  });

  it("does not let a replace import trip the operation_id unique index on duplicate rows", async () => {
    // Two distinct ledger rows would collide on operation_id only if crafted;
    // the within-backup dedup must prevent any such collision from failing the
    // whole import.
    const data = await seededData();
    const row0 = data.currencyLedger[0];
    const crafted = {
      ...row0,
      id: undefined,
    } as unknown as BackupData["currencyLedger"][number];
    const withDup = {
      ...data,
      currencyLedger: [
        ...data.currencyLedger,
        { ...crafted, operationId: row0.operationId },
      ],
    };
    const env = buildEnvelope(withDup);

    const target = await makeDb();
    const res = await applyImport(
      target,
      parseAndValidateBackup(serializeBackup(env)),
      "replace",
    );
    expect(res.ledgerAdded).toBe(data.currencyLedger.length);
  });
});

describe("idempotency of repeated restore (the critical no-duplication rule)", () => {
  async function exportParsed(src: AppDatabase) {
    const env = await exportLocalData(src, { now: () => T0 + 1 });
    return parseAndValidateBackup(serializeBackup(env));
  }

  it("repeated merge restore adds nothing after the first", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = await exportParsed(src);

    const target = await makeDb();
    const first = await applyImport(target, parsed, "merge");
    const second = await applyImport(target, parsed, "merge");
    const third = await applyImport(target, parsed, "merge");

    expect(first.sessionsAdded).toBe(2);
    expect(second.sessionsAdded).toBe(0);
    expect(second.sessionsSkipped).toBe(2);
    expect(second.ledgerAdded).toBe(0);
    expect(third.sessionsAdded).toBe(0);
    // The balance must be exactly the seed balance, never doubled.
    expect(await target.ledger.getBalance()).toBe(15); // 10 + 5 (op-1 + null)
  });

  it("repeated replace restore is idempotent (same counts every time)", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = await exportParsed(src);

    const target = await makeDb();
    const r1 = await applyImport(target, parsed, "replace");
    const r2 = await applyImport(target, parsed, "replace");
    const r3 = await applyImport(target, parsed, "replace");

    for (const r of [r1, r2, r3]) {
      expect(r.sessionsAdded).toBe(2);
      expect(r.ledgerAdded).toBe(2);
    }
    expect(await target.sessions.listRecent(10000)).toHaveLength(2);
    expect(await target.ledger.list(10000)).toHaveLength(2);
  });

  it("merge of two different-device backups keeps both devices' sessions without duplication", async () => {
    const src1 = await makeDb();
    await seedFixture(src1); // s1, s2
    const parsed1 = await exportParsed(src1);

    const target = await makeDb();
    await applyImport(target, parsed1, "merge");

    const src2 = await makeDb();
    await seedFixture(src2);
    await src2.transaction(async (txn) =>
      txn.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ["s3", "logic", 1, 1, 1, 7, "{}", "{}", 0.5, 30, T0, T0 + 1, 400],
      ),
    );
    const parsed2 = await exportParsed(src2);

    const res = await applyImport(target, parsed2, "merge");
    expect(res.sessionsAdded).toBe(1); // only s3 is new
    expect(await target.sessions.listRecent(10000)).toHaveLength(3);
  });
});

describe("imported timestamps and old schema versions", () => {
  it("preserves the backed-up completedAt exactly (never overwritten by the clock)", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = parseAndValidateBackup(
      serializeBackup(await exportLocalData(src, { now: () => T0 + 1 })),
    );
    const target = await makeDb();
    await applyImport(target, parsed, "replace");

    const s1 = (await target.sessions.getById("s1"))!;
    expect(s1.completedAt).toBe(T0 + 100); // exactly the seed value, not now()
    expect(s1.startedAt).toBe(T0);
  });

  it("accepts an imported backup with an old schema version (informational only)", async () => {
    const data = await seededData();
    const env = buildEnvelope(data, { schemaVersion: 1 });
    const parsed = parseAndValidateBackup(serializeBackup(env));
    expect(parsed.envelope.schemaVersion).toBe(1);

    const target = await makeDb();
    const res = await applyImport(target, parsed, "replace");
    expect(res.sessionsAdded).toBe(2);
    expect(await target.sessions.listRecent(10000)).toHaveLength(2);
  });
});

describe("ordering independence and canonical serialization", () => {
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  it("produces byte-identical text for two exports of the same database", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const a = serializeBackup(
      await exportLocalData(src, { now: () => T0 + 1 }),
    );
    const b = serializeBackup(
      await exportLocalData(src, { now: () => T0 + 1 }),
    );
    expect(a).toBe(b);
  });

  it("imports the same database state regardless of record order in the text", async () => {
    const data = await seededData();
    const ordered = buildEnvelope(data);
    const reordered = buildEnvelope({
      ...data,
      gameSessions: shuffle(data.gameSessions),
      currencyLedger: shuffle(data.currencyLedger),
      domainRatings: shuffle(data.domainRatings),
      ratingHistory: shuffle(data.ratingHistory),
    });

    const t1 = await makeDb();
    await applyImport(
      t1,
      parseAndValidateBackup(serializeBackup(ordered)),
      "replace",
    );
    const t2 = await makeDb();
    await applyImport(
      t2,
      parseAndValidateBackup(serializeBackup(reordered)),
      "replace",
    );

    // Import is order-independent: the re-exported state (arrays normalized
    // by element, ignoring insertion-order artifacts like autoincrement ids)
    // must be identical regardless of record order in the source text.
    const normalize = (d: BackupData): string => {
      const copy: Record<string, unknown> = { ...d };
      for (const key of Object.keys(copy)) {
        const v = copy[key];
        if (Array.isArray(v)) {
          copy[key] = [...v].sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b)),
          );
        }
      }
      return canonicalString(copy);
    };
    const c1 = normalize((await exportLocalData(t1, { now: () => T0 + 999 })).data);
    const c2 = normalize((await exportLocalData(t2, { now: () => T0 + 999 })).data);
    expect(c1).toBe(c2);
  });
});

describe("empty / huge backups", () => {
  it("imports an empty backup (null profile, empty sections) leaving only a fresh profile", async () => {
    const env = buildEnvelope(emptyData());
    const target = await makeDb();
    const res = await applyImport(
      target,
      parseAndValidateBackup(serializeBackup(env)),
      "replace",
    );
    expect(res.totalWritten).toBe(0);
    expect(await target.sessions.listRecent(10000)).toHaveLength(0);
    expect(await target.ledger.list(10000)).toHaveLength(0);
    // An empty backup carries no profile, so replace leaves no profile row
    // (the app recreates the singleton on next launch via ensureExists).
    expect(await target.profile.get()).toBeNull();
    await target.profile.ensureExists();
    expect(await target.profile.get()).not.toBeNull();
  });

  it("imports a huge backup (thousands of rows) completely and idempotently", async () => {
    const data = emptyData();
    const N = 4000;
    for (let i = 0; i < N; i++) {
      data.gameSessions.push({
        id: `h${i}`,
        gameId: "memory",
        gameVersion: 1,
        generatorVersion: 1,
        scoringVersion: 1,
        seed: i,
        difficulty: { i },
        rawResult: { i },
        normalizedResult: 0.5,
        xp: 10,
        startedAt: T0 + i,
        completedAt: T0 + i + 1,
        durationMs: 1000,
      });
      data.currencyLedger.push({
        amount: 10,
        reason: "gameplay",
        sessionId: `h${i}`,
        createdAt: T0 + i + 1,
        operationId: `gameplay:h${i}`,
      });
    }

    const env = buildEnvelope(data);
    const target = await makeDb();
    const res = await applyImport(
      target,
      parseAndValidateBackup(serializeBackup(env)),
      "replace",
    );
    expect(res.sessionsAdded).toBe(N);
    expect(res.ledgerAdded).toBe(N);
    expect(await target.sessions.listRecent(10000)).toHaveLength(N);
    expect(await target.ledger.list(10000)).toHaveLength(N);
    expect(await target.ledger.getBalance()).toBe(N * 10);

    // Repeated restore must not duplicate.
    const res2 = await applyImport(
      target,
      parseAndValidateBackup(serializeBackup(env)),
      "replace",
    );
    expect(res2.sessionsAdded).toBe(N); // replace clears then re-inserts all N
    expect(res2.ledgerAdded).toBe(N);
    expect(await target.sessions.listRecent(10000)).toHaveLength(N);
  });
});

describe("preview counters match real apply counters", () => {
  it("previewImport reports the same counters a real import would apply", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const text = serializeBackup(
      await exportLocalData(src, { now: () => T0 + 1 }),
    );

    const mode: ImportMode = "merge";
    const preview = await previewImport(await makeDb(), text, mode);
    const target = await makeDb();
    const real = await applyImport(target, parseAndValidateBackup(text), mode);

    expect(preview.valid).toBe(true);
    expect(preview.counters.sessionsAdded).toBe(real.sessionsAdded);
    expect(preview.counters.ledgerAdded).toBe(real.ledgerAdded);
    expect(preview.counters.domainRatingsUpdated).toBe(
      real.domainRatingsUpdated,
    );
    expect(preview.counters.ratingHistoryAdded).toBe(real.ratingHistoryAdded);
    // Preview must never mutate the database it inspected.
    expect(await target.sessions.listRecent(10000)).toHaveLength(2);
  });
});

describe("wipe then restore, and conflicting-equipped-cosmetics merge", () => {
  it("wipes local data then restores from a backup (full round-trip)", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = parseAndValidateBackup(
      serializeBackup(await exportLocalData(src, { now: () => T0 + 1 })),
    );

    const target = await makeDb();
    await seedFixture(target); // some pre-existing data
    await wipeLocalData(target);
    const counts = await countLocalData(target);
    expect(counts.gameSessions).toBe(0);
    expect(counts.hasProfile).toBe(false);

    await applyImport(target, parsed, "replace");
    expect(await target.sessions.listRecent(10000)).toHaveLength(2);
    expect(await target.ledger.list(10000)).toHaveLength(2);
  });

  it("merge takes the backup's equipped cosmetics when target differs (conflict resolution)", async () => {
    const target = await makeDb();
    // Target equips 'theme-sunset' in the accent slot.
    await target.profile.update({
      settings: {
        cosmetics: {
          owned: ["theme-sunset"],
          equipped: { accent: "theme-sunset" },
        },
      },
    });

    const data = emptyData();
    data.profile = {
      id: "local",
      displayName: "Backup",
      settings: {
        cosmetics: {
          owned: ["theme-midnight"],
          equipped: { accent: "theme-midnight" },
        },
      },
      createdAt: T0,
      updatedAt: T0 + 5,
    };
    const env = buildEnvelope(data);
    const res = await applyImport(
      target,
      parseAndValidateBackup(serializeBackup(env)),
      "merge",
    );
    expect(res.profileMerged).toBe(true);

    const settings = (await target.profile.get())?.settings ?? {};
    const cosmetics =
      (settings.cosmetics as { equipped?: Record<string, string> })?.equipped ??
      {};
    // Backup wins for the conflicting slot (last-write-wins via settings spread).
    expect(cosmetics.accent).toBe("theme-midnight");
  });
});
