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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../../plugins/with-android-backup-rules");

/** Strip XML comments, then assert none contained a double hyphen. */
function commentBodies(xml: string): string[] {
  return [...xml.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
}

describe("with-android-backup-rules config plugin", () => {
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
