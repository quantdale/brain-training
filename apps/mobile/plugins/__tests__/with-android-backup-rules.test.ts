/**
 * Config-plugin pinning tests: plugins/with-android-backup-rules.js
 * (campaign 011 closure, CNG durability).
 *
 * The auto-backup policy (campaign-010 audit B7) used to live only in the
 * gitignored `android/` directory and silently vanished on every clean
 * `expo prebuild`. The local config plugin is now the committed source of
 * truth; these tests pin its generated artifacts:
 *
 *   - both rule XMLs exclude the whole `database` domain for cloud backup,
 *     device transfer, and (API <= 30) full backup;
 *   - NO comment contains an illegal `--` sequence (an XML-comment hazard
 *     that broke a manifest merge once already);
 *   - the manifest mod applies both `@xml/...` attributes idempotently.
 */
import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SaxesParser } = require("saxes");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../../plugins/with-android-backup-rules");

/** Strip XML comments, then assert none contained a double hyphen. */
function commentBodies(xml: string): string[] {
  return [...xml.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
}

describe("with-android-backup-rules config plugin", () => {
  it("generated mods exclude Expo SQLite files and sidecars in every transport", async () => {
    const nativeSource = fs.readFileSync(path.join(path.dirname(require.resolve("expo-sqlite/package.json")), "android/src/main/java/expo/modules/sqlite/SQLiteModule.kt"), "utf8");
    expect(nativeSource).toContain('context.filesDir.canonicalPath + File.separator + "SQLite"');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "backup-rules-mod-"));
    try {
      const config = plugin({ name: "test", slug: "test" });
      const modRequest = { platformProjectRoot: root };
      await config.mods.android.dangerous({ ...config, modRequest });
      const manifest = { manifest: { application: [{ $: {} }] } };
      const result = await config.mods.android.manifest({ ...config, modRequest, modResults: manifest });
      expect(result.modResults.manifest.application[0].$).toEqual({
        "android:dataExtractionRules": "@xml/data_extraction_rules",
        "android:fullBackupContent": "@xml/backup_rules",
      });
      for (const [file, transports] of [
        ["data_extraction_rules.xml", ["cloud-backup", "device-transfer"]],
        ["backup_rules.xml", ["full-backup-content"]],
      ] as const) {
        const rules = new Map<string, { domain: string; path: string }[]>();
        let transport = "";
        const parser = new SaxesParser();
        parser.on("opentag", (tag: { name: string; attributes: Record<string, string> }) => {
          if (transports.some((name) => name === tag.name)) { transport = tag.name; rules.set(transport, []); }
          if (tag.name === "exclude") rules.get(transport)?.push({ domain: tag.attributes.domain, path: tag.attributes.path });
        });
        parser.write(fs.readFileSync(path.join(root, "app/src/main/res/xml", file), "utf8")).close();
        for (const name of transports) {
          const exclusions = rules.get(name) ?? [];
          expect(exclusions).toContainEqual({ domain: "database", path: "." });
          for (const relativeFile of ["SQLite/brain-training.db", "SQLite/brain-training.db-wal", "SQLite/brain-training.db-shm"]) {
            expect(exclusions.some((rule) => rule.domain === "file" && relativeFile.startsWith(`${rule.path}/`))).toBe(true);
          }
          expect(exclusions.some((rule) => rule.domain === "file" && rule.path === ".")).toBe(false);
        }
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it("exports non-empty data-extraction rules covering cloud + device transfer", () => {
    const xml = plugin.DATA_EXTRACTION_RULES_XML as string;
    expect(xml).toContain("<data-extraction-rules>");
    expect(xml).toMatch(/<cloud-backup>[\s\S]*exclude domain="database"/);
    expect(xml).toMatch(/<device-transfer>[\s\S]*exclude domain="database"/);
  });

  it("exports full-backup content excluding the database domain (API <= 30)", () => {
    const xml = plugin.BACKUP_RULES_XML as string;
    expect(xml).toContain("<full-backup-content>");
    expect(xml).toMatch(/<exclude domain="database" path="\." \/>/);
  });

  it('never emits illegal "--" sequences inside XML comments', () => {
    for (const xml of [
      plugin.DATA_EXTRACTION_RULES_XML as string,
      plugin.BACKUP_RULES_XML as string,
    ]) {
      for (const body of commentBodies(xml)) {
        expect(body).not.toContain("--");
      }
    }
  });

  it("rule files are balanced, well-formed XML documents", () => {
    for (const xml of [
      plugin.DATA_EXTRACTION_RULES_XML as string,
      plugin.BACKUP_RULES_XML as string,
    ]) {
      const withoutComments = xml
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]*\/>/g, ""); // self-closing elements have no close tag
      const opens = withoutComments.match(/<[a-zA-Z-]+[\s>]/g) ?? [];
      const closes = withoutComments.match(/<\/[a-zA-Z-]+>/g) ?? [];
      expect(opens.length).toBe(closes.length);
    }
  });
});
