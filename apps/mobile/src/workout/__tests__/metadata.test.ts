/**
 * Instance-key + metadata model coverage (campaign 011 W07).
 *
 * Pins the V2 identity scheme (bare-date daily keys, `<date>::<templateId>::
 * <length>` template keys) and the defensive parsing policy: malformed keys
 * and drifted `metadata_json` payloads degrade instead of crashing, and a
 * structurally valid generation-inputs snapshot round-trips through
 * `parseWorkoutMetadata` (provenance must survive a db read).
 */
import { describe, expect, it } from '@jest/globals';

import {
  createWorkoutMetadata,
  dailyInstanceKey,
  dailySelectionSeed,
  isTemplateInstanceKey,
  parseInstanceKey,
  parseWorkoutMetadata,
  templateInstanceKey,
  templateSelectionSeed,
  WORKOUT_METADATA_VERSION,
  WORKOUT_SELECTION_SEED_VERSION,
} from '@/workout/metadata';

describe('instance keys', () => {
  it('daily keys are the bare date; template keys are namespaced', () => {
    expect(dailyInstanceKey('2026-08-21')).toBe('2026-08-21');
    expect(templateInstanceKey('2026-08-21', 'focus-memory', 'short')).toBe(
      '2026-08-21::focus-memory::short',
    );
  });

  it('parseInstanceKey round-trips both kinds', () => {
    expect(parseInstanceKey('2026-08-21')).toEqual({
      date: '2026-08-21',
      kind: 'daily',
      templateId: null,
      length: null,
    });
    expect(parseInstanceKey('2026-08-21::focus-memory::extended')).toEqual({
      date: '2026-08-21',
      kind: 'template',
      templateId: 'focus-memory',
      length: 'extended',
    });
  });

  it('malformed keys degrade without throwing', () => {
    // Extra segments: leading parts still decode.
    expect(parseInstanceKey('2026-08-21::t::short::extra')).toEqual({
      date: '2026-08-21',
      kind: 'template',
      templateId: 't',
      length: 'short',
    });
    // Unknown length token → null length, key still usable for rendering.
    expect(parseInstanceKey('2026-08-21::t::gigantic').length).toBeNull();
    // Empty-ish key never crashes.
    expect(parseInstanceKey('::weird').kind).toBe('template');
    expect(isTemplateInstanceKey('2026-08-21')).toBe(false);
    expect(isTemplateInstanceKey('2026-08-21::t::short')).toBe(true);
  });

  it('selection seeds follow the documented canonical formats', () => {
    expect(dailySelectionSeed('2026-08-21')).toBe('workout::2026-08-21::0');
    expect(dailySelectionSeed('2026-08-21', 3)).toBe('workout::2026-08-21::3');
    expect(templateSelectionSeed('2026-08-21', 'focus-memory', 'short', 1)).toBe(
      'workout::2026-08-21::focus-memory::short::1',
    );
  });

  it('pins the version constants', () => {
    expect(WORKOUT_METADATA_VERSION).toBe(1);
    expect(WORKOUT_SELECTION_SEED_VERSION).toBe(2); // daily path persists seedVersion 1
  });
});

describe('parseWorkoutMetadata (defensive)', () => {
  const valid = createWorkoutMetadata({
    kind: 'template',
    templateId: 'focus-memory',
    length: 'standard',
    focus: 'Memory',
    inputs: {
      domainRatings: { Memory: 950 },
      recentGameIds: ['a', 'b'],
      seed: 'workout::2026-08-21::focus-memory::standard::0',
    },
  });

  it('accepts a valid payload and round-trips the generation inputs', () => {
    const parsed = parseWorkoutMetadata(JSON.parse(JSON.stringify(valid)));
    expect(parsed).toEqual(valid);
    expect(parsed?.inputs).toEqual(valid.inputs);
  });

  it('rejects structurally invalid payloads', () => {
    expect(parseWorkoutMetadata(undefined)).toBeUndefined();
    expect(parseWorkoutMetadata(null)).toBeUndefined();
    expect(parseWorkoutMetadata('nope')).toBeUndefined();
    expect(parseWorkoutMetadata([valid])).toBeUndefined(); // array, not object
    expect(parseWorkoutMetadata({ ...valid, version: 'one' })).toBeUndefined();
    expect(parseWorkoutMetadata({ ...valid, kind: 'party' })).toBeUndefined();
    expect(parseWorkoutMetadata({ ...valid, templateId: 7 })).toBeUndefined();
    expect(parseWorkoutMetadata({ ...valid, length: 'infinite' })).toBeUndefined();
  });

  it('coerces focus to null when absent and keeps parsing tolerant of drift', () => {
    const parsed = parseWorkoutMetadata({
      version: 1,
      kind: 'daily',
      templateId: 'daily-mix',
      length: 'standard',
      focus: 42,
    });
    expect(parsed?.focus).toBeNull();
  });

  it('drops a malformed inputs snapshot but keeps the rest of the metadata', () => {
    const parsed = parseWorkoutMetadata({
      ...valid,
      inputs: { domainRatings: 'not-a-map', seed: 12 },
    });
    expect(parsed?.templateId).toBe('focus-memory');
    expect(parsed?.inputs).toBeUndefined();

    const partial = parseWorkoutMetadata({
      ...valid,
      inputs: { domainRatings: { Memory: 'high' }, recentGameIds: ['a'], seed: 's' },
    });
    expect(partial?.inputs).toBeUndefined(); // non-numeric rating poisons the snapshot
  });
});
