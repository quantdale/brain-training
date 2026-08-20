import { describe, expect, it } from "@jest/globals";
import {
  exportLocalData,
  serializeBackup,
  parseAndValidateBackup,
  previewImport,
} from "../index";
import { makeDb, seedFixture, T0 } from "./helpers";

describe("previewImport", () => {
  it("produces a valid dry-run report for merge without mutating", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const text = serializeBackup(
      await exportLocalData(src, { now: () => T0 + 1 }),
    );

    const target = await makeDb();
    const targetBefore = (await target.sessions.listRecent(1000)).length;

    const preview = await previewImport(target, text, "merge");
    expect(preview.valid).toBe(true);
    expect(preview.mode).toBe("merge");
    expect(preview.counters.sessionsAdded).toBe(2);
    expect(preview.counters.ledgerAdded).toBe(2);
    expect(preview.meta.counts.gameSessions).toBe(2);

    const targetAfter = (await target.sessions.listRecent(1000)).length;
    expect(targetAfter).toBe(targetBefore); // untouched
    expect(preview.notes.some((n) => n.toLowerCase().includes("merge"))).toBe(
      true,
    );
  });

  it("reports a destructive warning for replace and counts all entities", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const text = serializeBackup(
      await exportLocalData(src, { now: () => T0 + 1 }),
    );

    const target = await makeDb();
    const preview = await previewImport(target, text, "replace");
    expect(preview.valid).toBe(true);
    expect(preview.counters.sessionsAdded).toBe(2);
    expect(preview.notes.some((n) => /destructive|overwrite/i.test(n))).toBe(
      true,
    );
  });

  it("returns valid:false with the rejection reason for a corrupt backup", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const target = await makeDb();
    const original = serializeBackup(
      await exportLocalData(src, { now: () => T0 + 1 }),
    );
    // Corrupt the payload (Memory -> MemoryX) while keeping the original checksum, so validation must fail.
    const corrupt = original.replace('"Memory"', '"MemoryX"');
    const preview = await previewImport(target, corrupt, "merge");
    expect(preview.valid).toBe(false);
    expect(preview.error?.kind).toBe("checksum");
  });

  it("returns valid:false for a malformed (non-JSON) payload", async () => {
    const target = await makeDb();
    const preview = await previewImport(target, "totally not json", "merge");
    expect(preview.valid).toBe(false);
    expect(preview.error?.kind).toBe("malformed");
  });

  it("preview of a merge is itself idempotent (running it twice still mutates nothing)", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const text = serializeBackup(
      await exportLocalData(src, { now: () => T0 + 1 }),
    );
    const target = await makeDb();
    await previewImport(target, text, "merge");
    const targetStillEmpty = (await target.sessions.listRecent(1000)).length;
    expect(targetStillEmpty).toBe(0);
  });
});
