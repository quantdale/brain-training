/**
 * withAndroidBackupRules — local Expo config plugin (campaign 011 closure).
 *
 * Codifies the campaign-010 audit-B7 auto-backup policy into committed
 * source-of-truth configuration so it survives `expo prebuild --clean`:
 *
 *   - `allowBackup` stays TRUE: non-progress settings (theme, sensory
 *     preferences) survive device restore;
 *   - the SQLite `database` domain is EXCLUDED from cloud backup, device-to-
 *     device transfer, and (API <= 30) full backup, so a restore can never
 *     resurrect wiped progression data.
 *
 * Before this plugin these settings existed only as hand edits inside the
 * gitignored `android/` directory and silently vanished on every clean
 * prebuild. The mod:
 *
 *   1. writes `res/xml/data_extraction_rules.xml` (API 31+) and
 *      `res/xml/backup_rules.xml` (API <= 30) via a dangerous mod; and
 *   2. sets `android:dataExtractionRules` / `android:fullBackupContent` on
 *      `<application/>` via the manifest mod.
 *
 * XML-comment hazard: generated comments must never contain `--` (illegal
 * inside XML comments; broke a manifest merge once already). The strings
 * below are checked by scripts/validate-repo-state.mjs.
 *
 * minSdk note: 24 (Expo root-plugin default) < 31, so BOTH rule files are
 * required for full coverage. No AsyncStorage/RKStorage usage exists in src,
 * so the database-domain exclusion covers all canonical persistence.
 */
const { createRunOncePlugin, withAndroidManifest, withDangerousMod } =
  require("@expo/config-plugins");

const fs = require("node:fs");
const path = require("node:path");

const DATA_EXTRACTION_RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<!--
  Data extraction rules for API 31+ (android:dataExtractionRules).
  Auto-backup policy (campaign 010 audit B7, codified by the local config
  plugin plugins/with-android-backup-rules.js): exclude the entire database
  domain from both cloud backup and device-to-device transfer so wiped
  progression data cannot be resurrected by a restore. SharedPreferences
  remain eligible. Generated file: edit the plugin, not this copy.
-->
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="database" path="." />
    </cloud-backup>
    <device-transfer>
        <exclude domain="database" path="." />
    </device-transfer>
</data-extraction-rules>
`;

const BACKUP_RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<!--
  Auto-backup rules for API 30 and below (android:fullBackupContent).
  Campaign 010 audit B7: exclude the entire database domain so wiped
  progression data cannot be resurrected by a cloud restore. API 31+ devices
  use data_extraction_rules.xml instead. Generated file: edit the plugin
  (plugins/with-android-backup-rules.js), not this copy.
-->
<full-backup-content>
    <exclude domain="database" path="." />
</full-backup-content>
`;

/** Writes both rule files into the generated android project. */
function writeRuleFiles(androidRoot) {
  const resXmlDir = path.join(androidRoot, "app", "src", "main", "res", "xml");
  fs.mkdirSync(resXmlDir, { recursive: true });
  fs.writeFileSync(
    path.join(resXmlDir, "data_extraction_rules.xml"),
    DATA_EXTRACTION_RULES_XML,
  );
  fs.writeFileSync(path.join(resXmlDir, "backup_rules.xml"), BACKUP_RULES_XML);
}

const withBackupRuleFiles = (config) =>
  withDangerousMod(config, [
    "android",
    (modConfig) => {
      writeRuleFiles(modConfig.modRequest.platformProjectRoot);
      return modConfig;
    },
  ]);

const withBackupManifestAttributes = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error(
        "withAndroidBackupRules: no <application/> node in AndroidManifest",
      );
    }
    application.$["android:dataExtractionRules"] = "@xml/data_extraction_rules";
    application.$["android:fullBackupContent"] = "@xml/backup_rules";
    return modConfig;
  });

module.exports = createRunOncePlugin(
  (config) => withBackupManifestAttributes(withBackupRuleFiles(config)),
  "with-android-backup-rules",
  "1.0.0",
);

// Exported for validators/tests that pin the generated XML content.
module.exports.DATA_EXTRACTION_RULES_XML = DATA_EXTRACTION_RULES_XML;
module.exports.BACKUP_RULES_XML = BACKUP_RULES_XML;
