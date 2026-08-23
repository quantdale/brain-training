/**
 * withAndroidNdkPin — local Expo config plugin (campaign 011 closure).
 *
 * Keeps the host-required NDK version pinned across `expo prebuild --clean`.
 *
 * Why: ExpoRootProjectPlugin defaults `ndkVersion` to 27.1.12297006, whose
 * bundled `lld` rejects its own `android-legacy.toolchain.cmake` flags
 * (`--no-rosegment` / `-z`) on this host — `react-native-screens`
 * `configureCMakeDebug` fails (`BUILD FAILED`). Pinning 27.0.12077973 avoids
 * the broken toolchain (see .agent/VALIDATION.md AVD-hardening wave).
 *
 * Scope note: this pin is a HOST-toolchain workaround. CI never performs a
 * native Android build (.github/workflows/app-ci.yml: typecheck/lint/jest/
 * web-export/doctor only), so the pin only affects local emulator/device
 * builds on hosts that have the mismatching 27.1 side-by-side NDK installed.
 *
 * Durability history: this used to be a hand edit inside the gitignored
 * `android/gradle.properties`, and regeneration silently dropped it (the
 * next assembleDebug would fail again). As a committed config plugin the pin
 * is re-applied on every prebuild.
 *
 * `setIfNotExist` semantics in ExpoRootProjectPlugin mean an existing
 * project property wins, so writing the property into gradle.properties is
 * sufficient; no build.gradle surgery required.
 */
const { createRunOncePlugin, withGradleProperties } = require("@expo/config-plugins");

/** NDK version that builds react-native-screens CMake on this host. */
const PINNED_NDK_VERSION = "27.0.12077973";

/**
 * Pure property-list transform so tests can pin behavior without running
 * the mod pipeline: upserts ndkVersion = PINNED_NDK_VERSION, preserving all
 * other properties and their order.
 */
function applyNdkPin(props) {
  const existing = props.find(
    (item) => item.type === "property" && item.key === "ndkVersion",
  );
  if (existing) {
    existing.value = PINNED_NDK_VERSION;
    return props;
  }
  return [...props, { type: "property", key: "ndkVersion", value: PINNED_NDK_VERSION }];
}

const withAndroidNdkPin = (config) =>
  withGradleProperties(config, (modConfig) => {
    modConfig.modResults = applyNdkPin(modConfig.modResults);
    return modConfig;
  });

module.exports = createRunOncePlugin(
  withAndroidNdkPin,
  "with-android-ndk-pin",
  "1.0.0",
);
module.exports.PINNED_NDK_VERSION = PINNED_NDK_VERSION;
module.exports.applyNdkPin = applyNdkPin;
