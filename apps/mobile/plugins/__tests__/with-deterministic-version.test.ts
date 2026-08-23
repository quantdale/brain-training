/**
 * Tests for withDeterministicVersion — deterministic version/build mechanics.
 */
import { describe, expect, it } from "@jest/globals";

const {
  parseSemver,
  versionCodeFromSemver,
} = require("../with-deterministic-version");

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
