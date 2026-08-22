/**
 * Catalog-scale semantics for the Workout V2 engine (campaign 012 W06,
 * target: "test catalog sizes beyond 42 conceptually — synthetic 60-game
 * registries").
 *
 * The real registry currently ships 42 games; these suites prove every
 * template/length/rotation invariant on a SYNTHETIC 60-game catalog so a
 * future catalog expansion cannot silently break:
 *   - every generated focus template fills short/standard/extended exactly
 *     (2/4/6 distinct games) and deterministically,
 *   - when the focus pool alone can fill the workout (60/8 ⇒ ≥7 primaries per
 *     category ≥ 6 slots), EVERY slot is a primary-category match — the tier
 *     priority is not merely "usually",
 *   - secondary-domain matches rank between primaries and diverse fill,
 *   - `attempt` yields a stable deterministic alternative selection,
 *   - exclusions are honored at scale; degenerate catalogs degrade safely,
 *   - the daily chain keeps its overlap cap across a month at 60 games,
 *   - the rotation menu is derived from GAME_CATEGORIES only (size-invariant).
 */
import { describe, expect, it } from '@jest/globals';
import { createRng, GAME_CATEGORIES } from '@/sdk';
import type { GameCategory, GameDefinition } from '@/sdk';

import {
  allWorkoutTemplates,
  applyTemplatePersonalization,
  focusTemplates,
  gameCountForLength,
  selectTemplateWorkout,
} from '../templates';
import { rotatedTemplateForDate, rotationSuggestions } from '../rotation';
import { dailyWorkout, MAX_OVERLAP_WITH_YESTERDAY } from '../today';
import type { DomainRating } from '../personalize';

/** Synthetic registry factory: `count` games cycling the real categories. */
function makeSyntheticRegistry(count: number): GameDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `synthetic-${i}`,
    name: `Synthetic ${i}`,
    primaryCategory: GAME_CATEGORIES[i % GAME_CATEGORIES.length],
    // Every 5th game also lists 'Memory' as a secondary domain so tier-2
    // matching is exercised at scale for non-memory focus templates.
    secondaryDomains:
      i % 5 === 0 && i % GAME_CATEGORIES.length !== 0
        ? (['Memory'] as const)
        : undefined,
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: null,
    contentVersion: null,
    hasTutorial: false,
  }));
}

const REGISTRY_60 = makeSyntheticRegistry(60);
const LENGTHS = ['short', 'standard', 'extended'] as const;

describe('focus templates over a synthetic 60-game registry', () => {
  it(`fills every length exactly (${LENGTHS.join('/')} = 2/4/6), distinct and deterministic`, () => {
    for (const template of focusTemplates()) {
      for (const length of LENGTHS) {
        const first = selectTemplateWorkout({
          games: REGISTRY_60,
          template,
          length,
          date: '2026-08-21',
        });
        expect(first.games).toHaveLength(gameCountForLength(length));
        expect(new Set(first.games.map((g) => g.id)).size).toBe(
          gameCountForLength(length),
        );

        const second = selectTemplateWorkout({
          games: REGISTRY_60,
          template,
          length,
          date: '2026-08-21',
        });
        expect(second.games.map((g) => g.id)).toEqual(first.games.map((g) => g.id));
        expect(second.seed).toBe(first.seed);
      }
    }
  });

  it('keeps every slot in the focus tier whenever the focus pool can fill alone', () => {
    // 60 games / 8 categories ⇒ 7–8 primaries each — always ≥ extended's 6
    // slots, so top-up fill must never fire.
    for (const template of focusTemplates()) {
      const selection = selectTemplateWorkout({
        games: REGISTRY_60,
        template,
        length: 'extended',
        date: '2027-02-14',
      });
      for (const game of selection.games) {
        expect(game.primaryCategory).toBe(template.focus);
      }
    }
  });

  it('ranks secondary-domain matches between primaries and fill', () => {
    const unrelated = makeSyntheticRegistry(12).map((g, i) => ({
      ...g,
      id: `filler-${i}`,
      primaryCategory: 'Speed' as GameCategory,
      secondaryDomains: undefined,
    }));
    const games: GameDefinition[] = [
      ...unrelated,
      { ...unrelated[0], id: 'primary-one', primaryCategory: 'Memory' },
      { ...unrelated[0], id: 'secondary-a', primaryCategory: 'Attention', secondaryDomains: ['Memory'] },
      { ...unrelated[0], id: 'secondary-b', primaryCategory: 'Math', secondaryDomains: ['Memory'] },
    ];
    const selection = selectTemplateWorkout({
      games,
      template: allWorkoutTemplates().find((t) => t.id === 'focus-memory')!,
      length: 'standard', // 4 slots: 1 primary + 2 secondaries + 1 fill
      date: '2026-08-21',
    });
    const headIds = new Set(selection.games.slice(0, 3).map((g) => g.id));
    expect(headIds).toEqual(new Set(['primary-one', 'secondary-a', 'secondary-b']));
    // The remaining slot comes from the diverse-fill remainder.
    expect(selection.games[3].id.startsWith('filler-')).toBe(true);
    expect(new Set(selection.games.map((g) => g.id)).size).toBe(4);
  });

  it('attempt yields a stable deterministic alternative selection', () => {
    const args = {
      games: REGISTRY_60,
      template: allWorkoutTemplates().find((t) => t.id === 'focus-memory')!,
      length: 'standard' as const,
      date: '2026-08-21',
    };
    const base = selectTemplateWorkout({ ...args });
    const alt = selectTemplateWorkout({ ...args, attempt: 1 });
    const altAgain = selectTemplateWorkout({ ...args, attempt: 1 });
    expect(alt.seed).not.toBe(base.seed);
    expect(altAgain.games.map((g) => g.id)).toEqual(alt.games.map((g) => g.id));
    expect(alt.games.map((g) => g.id)).not.toEqual(base.games.map((g) => g.id));
  });

  it('honors exclusions at scale without shrinking the workout', () => {
    const excluded = REGISTRY_60.slice(0, 10).map((g) => g.id);
    for (const template of [focusTemplates()[3], focusTemplates()[7]]) {
      const selection = selectTemplateWorkout({
        games: REGISTRY_60,
        template,
        length: 'extended',
        date: '2026-08-21',
        exclude: excluded,
      });
      expect(selection.games).toHaveLength(6);
      for (const game of selection.games) {
        expect(excluded).not.toContain(game.id);
      }
    }
  });

  it('degrades safely on degenerate catalogs (empty / single-game)', () => {
    const template = focusTemplates()[0];
    expect(
      selectTemplateWorkout({ games: [], template, length: 'standard', date: '2026-08-21' }).games,
    ).toEqual([]);
    const single = selectTemplateWorkout({
      games: [REGISTRY_60[0]],
      template,
      length: 'extended',
      date: '2026-08-21',
    });
    expect(single.games).toHaveLength(1); // never pads by duplicating
  });

  it('personalization reorders members deterministically at scale', () => {
    const template = allWorkoutTemplates().find((t) => t.id === 'focus-spatial')!;
    const selection = selectTemplateWorkout({
      games: REGISTRY_60,
      template,
      length: 'extended',
      date: '2026-08-21',
    });
    const ratings: DomainRating[] = [
      { domain: template.focus!, rating: 850, updatedAt: 1 },
    ];
    const input = {
      domainRatings: ratings,
      recentGameIds: selection.games.slice(-2).map((g) => g.id),
      seed: selection.seed,
      options: { nowMs: 10_000_000 },
    };
    const once = applyTemplatePersonalization(selection.games, input);
    const twice = applyTemplatePersonalization(selection.games, input);
    expect(twice.map((g) => g.id)).toEqual(once.map((g) => g.id));
    // Members preserved, weak-domain games surface first.
    expect([...once].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...selection.games].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(once[0].primaryCategory).toBe(template.focus);
  });
});

describe('daily chain + rotation invariants at 60 games', () => {
  it('keeps the consecutive-day overlap cap and full size across a month', () => {
    let previous: string[] = [];
    for (let day = 1; day <= 30; day += 1) {
      const date = `2026-09-${String(day).padStart(2, '0')}`;
      const workout = dailyWorkout(REGISTRY_60, date);
      expect(workout).toHaveLength(4);
      expect(new Set(workout.map((g) => g.id)).size).toBe(4);
      if (previous.length > 0) {
        const overlap = workout.filter((g) => previous.includes(g.id)).length;
        expect(overlap).toBeLessThanOrEqual(MAX_OVERLAP_WITH_YESTERDAY);
      }
      previous = workout.map((g) => g.id);
    }
  });

  it('rotation menu derives from GAME_CATEGORIES only (catalog-size invariant)', () => {
    const date = '2026-08-21';
    const suggestions = rotationSuggestions(date);
    expect(suggestions).toHaveLength(GAME_CATEGORIES.length + 1); // + daily mix
    expect(suggestions[0].id).toBe(rotatedTemplateForDate(date).id);
    expect(new Set(suggestions.map((t) => t.id)).size).toBe(suggestions.length);
    void createRng;
  });
});
