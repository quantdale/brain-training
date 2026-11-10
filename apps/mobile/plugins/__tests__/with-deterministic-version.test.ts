/**
 * Tests for withDeterministicVersion — deterministic version/build mechanics.
 */
import { describe, expect, it } from "@jest/globals";

// The plugin is plain CJS outside the tsconfig include, so it has no type
// declarations a static import could resolve. Same shape as the sibling plugin
// tests: one `require` behind a directive that actually sits on the statement it
// suppresses.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../with-deterministic-version");
const { iosBuildNumberFor, parseSemver, versionCodeFromSemver } = plugin;

describe("versionCodeFromSemver", () => {
  it("encodes the current app version deterministically", () => {
    expect(versionCodeFromSemver("0.1.0")).toBe(1_000);
  });

  it("is monotonic across semver bumps (patch < minor < major ordering)", () => {
    expect(versionCodeFromSemver("0.1.9")).toBeLessThan(
      versionCodeFromSemver("0.2.0"),
    );
    expect(versionCodeFromSemver("0.999.999")).toBeLessThan(
      versionCodeFromSemver("1.0.0"),
    );
  });

  it("rejects non-semver versions loudly at prebuild time", () => {
    expect(() => versionCodeFromSemver("1.2")).toThrow(/MAJOR\.MINOR\.PATCH/);
    expect(() => versionCodeFromSemver("")).toThrow(/MAJOR\.MINOR\.PATCH/);
    expect(() => versionCodeFromSemver(undefined)).toThrow(/MAJOR\.MINOR\.PATCH/);
  });

  it("rejects values outside the encoding range before they can wrap", () => {
    expect(() => versionCodeFromSemver("1000.0.0")).toThrow(/encoding range/);
    expect(() => versionCodeFromSemver("0.1000.0")).toThrow(/encoding range/);
  });

  it("parseSemver extracts integer components", () => {
    expect(parseSemver("12.34.56")).toEqual({
      major: 12,
      minor: 34,
      patch: 56,
    });
  });
});

describe("iosBuildNumberFor", () => {
  it("defaults to the marketing version for reproducible local builds", () => {
    expect(iosBuildNumberFor("0.1.0", {})).toBe("0.1.0");
    expect(iosBuildNumberFor("0.1.0", { IOS_BUILD_NUMBER: "" })).toBe("0.1.0");
  });

  it("uses IOS_BUILD_NUMBER so repeat uploads of one version can increase", () => {
    expect(iosBuildNumberFor("0.1.0", { IOS_BUILD_NUMBER: "42" })).toBe("42");
    expect(iosBuildNumberFor("0.1.0", { IOS_BUILD_NUMBER: "1.0.7" })).toBe("1.0.7");
  });

  it("rejects values Apple would refuse", () => {
    expect(() => iosBuildNumberFor("0.1.0", { IOS_BUILD_NUMBER: "1.2.3.4" })).toThrow(/IOS_BUILD_NUMBER/);
    expect(() => iosBuildNumberFor("0.1.0", { IOS_BUILD_NUMBER: "rc1" })).toThrow(/IOS_BUILD_NUMBER/);
  });
});
