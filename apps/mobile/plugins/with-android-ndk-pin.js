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
 * Durability history: this used to be a hand edit inside the gitignored
 * `android/gradle.properties`, and regeneration silently dropped it (the
 * next assembleDebug would fail again). As a committed config plugin the pin
 * is re-applied on every prebuild.
 *
 * `setIfNotExist` semantics in ExpoRootProjectPlugin mean an existing
 * project property wins, so writing the property into gradle.properties is
 * sufficient; no build.gradle surgery required.
 */
const { createRunOncePlugin, withGradleProperties } =
   require("@expo/config-plugins");

/** NDK version that builds react-native-screens CMake on this host. */
const PINNED_NDK_VERSION = "27.0.12077973";

const withAndroidNdkPin = (config) =>
   withGradleProperties(config, (modConfig) => {
      const props = modConfig.modResults;
      const existing = props.find(
         (item) => item.type === "property" && item.key === "ndkVersion",
      );
      if (existing) {
         if (existing.value !== PINNED_NDK_VERSION) {
            existing.value = PINNED_NDK_VERSION;
         }
      } else {
         props.push({
            type: "property",
            key: "ndkVersion",
            value: PINNED_NDK_VERSION,
         });
      }
      return modConfig;
   });

module.exports = createRunOncePlugin(
   withAndroidNdkPin,
   "with-android-ndk-pin",
   "1.0.0",
);
module.exports.PINNED_NDK_VERSION = PINNED_NDK_VERSION;
