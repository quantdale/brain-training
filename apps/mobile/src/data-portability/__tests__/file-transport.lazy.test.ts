/**
 * Lazy native-import guard for the file transport (campaign 011 closure).
 *
 * Pins the operational fix for the campaign-011 startup-crash incident: the
 * installed dev-client APK predated expo-file-system/expo-document-picker/
 * expo-sharing, and statically imported native modules crashed the whole app
 * at startup (`Cannot find native module 'ExpoDocumentPicker'`). After the
 * fix, `file-transport.ts` must:
 *
 *   1. be importable WITHOUT evaluating any native module (module-eval side
 *      effect free), so route tables/barrels can reference it safely; and
 *   2. surface a typed, diagnostic error naming the dev-client rebuild remedy
 *      when an operation runs against a binary missing the compiled module.
 *
 * Uses its own module registry (resetModules) so it cannot interfere with
 * the semantic doubles in `file-transport.test.ts`.
 */
import { describe, expect, it, jest, beforeEach } from "@jest/globals";

/** Fresh registry per test: each case installs its own native doubles. */
beforeEach(() => {
  jest.resetModules();
});

describe("file-transport lazy native imports", () => {
  it("module evaluation does not require any native module", () => {
    const required: string[] = [];
    jest.mock("expo-file-system", () => {
      required.push("expo-file-system");
      return {};
    });
    jest.mock("expo-document-picker", () => {
      required.push("expo-document-picker");
      return {};
    });
    jest.mock("expo-sharing", () => {
      required.push("expo-sharing");
      return {};
    });

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../file-transport");
    });
    expect(required).toEqual([]);
  });

  it("transport creation stays lazy too (factory touches no natives)", () => {
    const required: string[] = [];
    jest.mock("expo-file-system", () => {
      required.push("expo-file-system");
      return {};
    });

    let createFileBackupTransport: () => unknown;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ({ createFileBackupTransport } = require("../file-transport"));
    });
    createFileBackupTransport!();
    expect(required).toEqual([]);
  });

  it("a stale binary surfaces as a typed diagnostic error, not a crash", async () => {
    jest.mock("expo-file-system", () => {
      // Simulates the exact failure shape of a dev client built before the
      // dependency existed (autolinking never baked the module in).
      throw new Error("Cannot find native module 'ExpoFileSystem'");
    });

    let mod: typeof import("../file-transport");
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require("../file-transport");
    });
    const t = mod!.createFileBackupTransport();
    await expect(t.listBackups()).rejects.toThrow(
      /unavailable in this app build .*Rebuild and reinstall the dev client .*ExpoFileSystem/s,
    );
  });

  it("picker errors carry the same diagnostic remedy", async () => {
    jest.mock("expo-document-picker", () => {
      throw new Error("Cannot find native module 'ExpoDocumentPicker'");
    });

    let mod: typeof import("../file-transport");
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require("../file-transport");
    });
    await expect(mod!.pickBackupFile()).rejects.toThrow(
      /expo-document-picker[\s\S]*npx expo run:android/,
    );
  });
});
