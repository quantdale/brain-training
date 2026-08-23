/**
 * withDeterministicVersion — local Expo config plugin (final-completion 013).
 *
 * Establishes deterministic internal version/build-number mechanics for
 * repeatable release candidates without touching the deferred store decisions:
 *
 *   - `android.versionCode` = MAJOR*1_000_000 + MINOR*1_000 + PATCH, derived
 *     from `expo.version` (the single source of truth). Monotonic for any
 *     semver bump while major < 1000 and minor < 1000, so store ordering can
 *     never regress when versions advance.
 *   - `ios.buildNumber` = the same semver string (CFBundleVersion accepts it).
 *
 * Before this plugin neither field was set: android.versionCode silently
 * defaulted to 1 forever and iOS had no buildNumber, making RC builds
 * indistinguishable. Business/store publication decisions remain deferred —
 * this only makes technical builds reproducible and ordered.
 */
const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

/** Parse a strict semver "MAJOR.MINOR.PATCH" string into numbers. */
function parseSemver(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || "").trim());
  if (!m) {
    throw new Error(
      `withDeterministicVersion: expo.version must be MAJOR.MINOR.PATCH, got "${version}"`,
    );
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

/** Deterministic monotonic Android versionCode from a semver string. */
function versionCodeFromSemver(version) {
  const { major, minor, patch } = parseSemver(version);
  if (major > 999 || minor > 999 || patch > 999_999) {
    throw new Error(
      `withDeterministicVersion: version ${version} exceeds the encoding range (major<1000, minor<1000, patch<=999999)`,
    );
  }
  return major * 1_000_000 + minor * 1_000 + patch;
}

function withDeterministicVersion(config) {
  const version = config.version;
  const versionCode = versionCodeFromSemver(version);

  // eslint-disable-next-line no-param-reassign
  config.android = {
    ...(config.android || {}),
    versionCode,
  };
  // eslint-disable-next-line no-param-reassign
  config.ios = {
    ...(config.ios || {}),
    buildNumber: version,
  };

  // Keep the manifest/info-plist in sync too: prebuild copies app.json values,
  // but an explicit mod guarantees the fields even when another plugin
  // rewrites the sections.
  return withInfoPlist(
    withAndroidManifest(config, (androidConfig) => {
      androidConfig.modResults.manifest.$ = {
        ...androidConfig.modResults.manifest.$,
        "android:versionCode": String(versionCode),
        "android:versionName": version,
      };
      return androidConfig;
    }),
    (iosConfig) => {
      iosConfig.modResults.CFBundleShortVersionString = version;
      iosConfig.modResults.CFBundleVersion = version;
      return iosConfig;
    },
  );
}

module.exports = withDeterministicVersion;
module.exports.parseSemver = parseSemver;
module.exports.versionCodeFromSemver = versionCodeFromSemver;
