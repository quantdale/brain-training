/**
 * Config-plugin pinning tests: plugins/with-android-ndk-pin.js
 * (campaign 011 closure, CNG durability; test added campaign 012 W14).
 *
 * The NDK pin used to live only as a hand edit in the gitignored
 * `android/gradle.properties` and silently vanished on every clean prebuild,
 * after which the next assembleDebug failed on this host's mismatching
 * 27.1 lld (see .agent/VALIDATION.md AVD-hardening wave). These tests pin:
 *
 *   - the exact host-required version string;
 *   - upsert semantics: an existing ndkVersion property is overwritten in
 *     place, a missing one is appended, and unrelated properties survive;
 *   - idempotency across repeated application.
 */
import { describe, expect, it } from "@jest/globals";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../../plugins/with-android-ndk-pin");

type GradleProp = { type: string; key: string; value?: string };

function propsOf(entries: [string, string][]): GradleProp[] {
  return entries.map(([key, value]) => ({ type: "property", key, value }));
}

describe("with-android-ndk-pin config plugin", () => {
  it("pins the exact host-required NDK version", () => {
    expect(plugin.PINNED_NDK_VERSION).toBe("27.0.12077973");
  });

  it("overwrites an existing ndkVersion property in place", () => {
    const props = propsOf([
      ["hermesEnabled", "true"],
      ["ndkVersion", "27.1.12297006"],
      ["newArchEnabled", "true"],
    ]);
    const out = plugin.applyNdkPin(props) as GradleProp[];
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.key)).toEqual([
      "hermesEnabled",
      "ndkVersion",
      "newArchEnabled",
    ]);
    expect(out[1].value).toBe(plugin.PINNED_NDK_VERSION);
  });

  it("appends ndkVersion when the property is missing", () => {
    const props = propsOf([
      ["hermesEnabled", "true"],
      ["newArchEnabled", "true"],
    ]);
    const out = plugin.applyNdkPin(props) as GradleProp[];
    expect(out).toHaveLength(3);
    expect(out[2]).toEqual({
      type: "property",
      key: "ndkVersion",
      value: plugin.PINNED_NDK_VERSION,
    });
  });

  it("ignores comment/empty lines and other entry types", () => {
    const props: GradleProp[] = [
      { type: "comment", key: "# Project-wide Gradle settings." },
      { type: "property", key: "org.gradle.parallel", value: "true" },
      { type: "empty", key: "" },
    ];
    const out = plugin.applyNdkPin(props);
    expect(out).toHaveLength(4);
    expect(out[3].key).toBe("ndkVersion");
  });

  it("is idempotent when applied repeatedly", () => {
    let props = propsOf([["ndkVersion", "27.1.12297006"]]);
    for (let i = 0; i < 3; i++) {
      props = plugin.applyNdkPin(props) as GradleProp[];
    }
    expect(props).toHaveLength(1);
    expect(props[0].value).toBe(plugin.PINNED_NDK_VERSION);
  });
});
