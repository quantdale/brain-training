/**
 * Release-boundary pin: dangerous Android/iOS permissions stay blocked at the
 * Expo config SOURCE so they survive every `expo prebuild --clean`
 * (campaign 011 CNG durability; pinned as a test by campaign 013 hardening).
 *
 * The enforcement point is app.json itself — `android.blockedPermissions`
 * strips the permissions from the merged manifest, and the expo-audio plugin
 * flags stop RECORD_AUDIO / NSMicrophoneUsageDescription (plus the media
 * playback foreground service) from ever being injected. If either knob
 * drifts, an offline-first brain-training app would ship microphone or
 * overlay-drawing permissions it never uses.
 */
import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_JSON = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "app.json"), "utf8"),
) as { expo: { android?: { blockedPermissions?: string[] }; plugins?: unknown[] } };

describe("Android permission release boundary", () => {
  it("blocks SYSTEM_ALERT_WINDOW and RECORD_AUDIO via blockedPermissions", () => {
    const blocked = APP_JSON.expo.android?.blockedPermissions ?? [];
    expect(blocked).toContain("android.permission.SYSTEM_ALERT_WINDOW");
    expect(blocked).toContain("android.permission.RECORD_AUDIO");
  });

  it("keeps expo-audio from injecting mic/record/background-playback surfaces", () => {
    const audio = APP_JSON.expo.plugins?.find(
      (p): p is [string, Record<string, unknown>] =>
        Array.isArray(p) && p[0] === "expo-audio",
    );
    expect(audio).toBeDefined();
    expect(audio![1].microphonePermission).toBe(false);
    expect(audio![1].recordAudioAndroid).toBe(false);
    expect(audio![1].enableBackgroundPlayback).toBe(false);
  });
});
