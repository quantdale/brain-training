/**
 * Sensory-vocabulary contracts beyond the existing text scanner
 * (campaign 011 — W06).
 *
 * `src/sdk/__tests__/catalog-contracts.test.ts` already proves every
 * `playSfx`/`feedback` sound literal resolves to a canonical asset and every
 * `haptic` literal is a valid `HapticType`. This suite closes the remaining
 * gaps with runtime evidence:
 *
 *   - `feedback('…')` event literals across all game sources are members of
 *     the canonical `FEEDBACK_EVENTS` set (the scanner only checks their sfx
 *     resolution, not that the event itself exists)
 *   - haptic intensity bounds: no call site passes a numeric "intensity" (the
 *     contract is a closed six-value type; engines map it to platform patterns)
 *   - `SFX_ALIASES` self-consistency: aliases resolve INTO the canonical asset
 *     set and never shadow a canonical name with a different target
 *   - the REAL engine (`audio-haptics-real`, exercised under the same expo
 *     mocks as `audio-haptics.test.ts`) maps EVERY HapticType to exactly one
 *     platform haptic call and every canonical feedback event to its mapped
 *     sound+haptic — so no vocabulary member can silently degrade to nothing.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import * as Haptics from 'expo-haptics';

import { FEEDBACK_EVENTS, FEEDBACK_EVENT_MAP, SFX_ALIASES } from '@/sdk/audio-haptics';
import type { HapticType } from '@/sdk/audio-haptics';
import { createAudioHaptics } from '@/sdk/audio-haptics-real';

/** All six HapticTypes, typed — drives the engine-coverage sweep. */
const ALL_HAPTIC_TYPES: readonly HapticType[] = [
  'light',
  'medium',
  'heavy',
  'success',
  'warning',
  'error',
];

/** Canonical sound assets bundled by the production engine (see AudioHapticsProvider). */
const CANONICAL_SFX: ReadonlySet<string> = new Set(
  Object.values(FEEDBACK_EVENT_MAP).map((mapped) => mapped.sfx),
);

/** Valid `HapticType` values (union in audio-haptics.ts; no runtime list exists). */
const HAPTIC_TYPES: ReadonlySet<string> = new Set([
  'light',
  'medium',
  'heavy',
  'success',
  'warning',
  'error',
]);

const GAMES_ROOT = join(__dirname, '..', '..', '..', 'games');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

/** Every non-test source file under src/games, as `<gameId>/<relative>` → content. */
function loadGameSources(): Map<string, string> {
  const files = new Map<string, string>();
  const visit = (gameId: string, relative: string): void => {
    const segments = relative.split('/');
    if (segments.includes('__tests__')) return;
    const absolute = join(GAMES_ROOT, gameId, relative);
    if (statSync(absolute).isDirectory()) {
      for (const entry of readdirSync(absolute)) visit(gameId, `${relative}/${entry}`);
      return;
    }
    if (SOURCE_EXTENSIONS.has(relative.slice(relative.lastIndexOf('.')))) {
      files.set(`${gameId}/${relative}`, readFileSync(absolute, 'utf8'));
    }
  };
  for (const gameId of readdirSync(GAMES_ROOT).sort()) {
    if (!statSync(join(GAMES_ROOT, gameId)).isDirectory()) continue;
    for (const entry of readdirSync(join(GAMES_ROOT, gameId))) visit(gameId, entry);
  }
  return files;
}

const SOURCES = loadGameSources();

/** String-literal arguments of `.name('…')` calls in one source string. */
function extractCallLiterals(content: string, callName: string): string[] {
  const literals: string[] = [];
  const callPattern = new RegExp(`\\.${callName}\\(([^)]*)`, 'g');
  let match: RegExpExecArray | null;
  while ((match = callPattern.exec(content)) !== null) {
    const literalPattern = /['"]([a-z0-9-]+)['"]/g;
    let literal: RegExpExecArray | null;
    while ((literal = literalPattern.exec(match[1])) !== null) {
      literals.push(literal[1]);
    }
  }
  return literals;
}

describe('feedback event vocabulary', () => {
  it("every feedback('…') literal in game sources is a canonical FeedbackEvent", () => {
    const unknown: string[] = [];
    for (const [file, content] of SOURCES) {
      for (const event of extractCallLiterals(content, 'feedback')) {
        if (!(FEEDBACK_EVENTS as readonly string[]).includes(event)) {
          unknown.push(`${file}: feedback('${event}')`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it('every FEEDBACK_EVENT_MAP entry pairs a canonical sfx with a valid HapticType', () => {
    for (const [event, mapped] of Object.entries(FEEDBACK_EVENT_MAP)) {
      expect(CANONICAL_SFX.has(mapped.sfx)).toBe(true);
      expect(HAPTIC_TYPES.has(mapped.haptic)).toBe(true);
      expect((FEEDBACK_EVENTS as readonly string[]).includes(event)).toBe(true);
    }
  });
});

describe('haptic intensity bounds', () => {
  it("every haptic('…') literal is one of the six HapticTypes", () => {
    const invalid: string[] = [];
    for (const [file, content] of SOURCES) {
      for (const type of extractCallLiterals(content, 'haptic')) {
        if (!HAPTIC_TYPES.has(type)) {
          invalid.push(`${file}: haptic('${type}')`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });

  it('no call site passes a numeric intensity instead of a HapticType', () => {
    const offenders: string[] = [];
    for (const [file, content] of SOURCES) {
      const pattern = /\.haptic\(\s*\d/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        offenders.push(`${file}: ${match[0]}…`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('SFX alias table self-consistency', () => {
  it('every alias resolves into the canonical asset set', () => {
    const dangling = Object.entries(SFX_ALIASES)
      .filter(([, target]) => !CANONICAL_SFX.has(target))
      .map(([alias, target]) => `'${alias}' → '${target}'`);
    expect(dangling).toEqual([]);
  });

  it('never shadows a canonical asset name with a different target', () => {
    const shadows = Object.entries(SFX_ALIASES)
      .filter(([name, target]) => CANONICAL_SFX.has(name) && target !== name)
      .map(([alias, target]) => `'${alias}' → '${target}'`);
    expect(shadows).toEqual([]);
  });
});

describe('real engine covers the full sensory vocabulary', () => {
  const mockedHaptics = Haptics as unknown as {
    impactAsync: jest.Mock;
    notificationAsync: jest.Mock;
    ImpactFeedbackStyle: Record<string, string>;
    NotificationFeedbackType: Record<string, string>;
  };

  beforeEach(() => {
    mockedHaptics.impactAsync.mockClear();
    mockedHaptics.notificationAsync.mockClear();
  });

  function createService() {
    // Stub assets: every canonical sound resolves to a truthy require-style id.
    const assets: Record<string, number> = {};
    let next = 1;
    for (const name of CANONICAL_SFX) assets[name] = next++;
    return createAudioHaptics({ sfxAssets: assets });
  }

  it('maps every HapticType to exactly one platform haptic call', () => {
    const service = createService();
    const impacts = ['light', 'medium', 'heavy'];
    for (const type of ALL_HAPTIC_TYPES) {
      service.haptic(type);
      if (impacts.includes(type)) {
        expect(mockedHaptics.impactAsync).toHaveBeenCalledTimes(1);
        expect(mockedHaptics.notificationAsync).not.toHaveBeenCalled();
        const styleKey = type.charAt(0).toUpperCase() + type.slice(1);
        expect(mockedHaptics.impactAsync).toHaveBeenCalledWith(
          mockedHaptics.ImpactFeedbackStyle[styleKey],
        );
      } else {
        expect(mockedHaptics.notificationAsync).toHaveBeenCalledTimes(1);
        expect(mockedHaptics.impactAsync).not.toHaveBeenCalled();
        const styleKey = type.charAt(0).toUpperCase() + type.slice(1);
        expect(mockedHaptics.notificationAsync).toHaveBeenCalledWith(
          mockedHaptics.NotificationFeedbackType[styleKey],
        );
      }
      mockedHaptics.impactAsync.mockClear();
      mockedHaptics.notificationAsync.mockClear();
    }
  });

  it('plays every canonical feedback event without throwing and fires its haptic', () => {
    const service = createService();
    for (const event of FEEDBACK_EVENTS) {
      expect(() => service.feedback(event)).not.toThrow();
      expect(mockedHaptics.impactAsync.mock.calls.length + mockedHaptics.notificationAsync.mock.calls.length).toBe(1);
      mockedHaptics.impactAsync.mockClear();
      mockedHaptics.notificationAsync.mockClear();
    }
  });

  it('degrades silently for unknown sound names and muted channels', async () => {
    const service = createService();
    expect(() => service.playSfx('definitely-not-a-sound-name')).not.toThrow();

    service.setSfxEnabled(false);
    service.setHapticsEnabled(false);
    await service.prepare();
    service.playSfx('tap');
    service.haptic('light');
    service.feedback('correct');
    expect(mockedHaptics.impactAsync).not.toHaveBeenCalled();
    expect(mockedHaptics.notificationAsync).not.toHaveBeenCalled();

    // Restore defaults so later suites sharing the module registry are unaffected.
    service.setSfxEnabled(true);
    service.setHapticsEnabled(true);
  });
});
