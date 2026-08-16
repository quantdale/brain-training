import { describe, expect, it } from '@jest/globals';
import { FavoritesRepository } from '../favorites';
import { createMigratedDb } from './helpers';

const T0 = 1_700_000_000_000;

describe('FavoritesRepository', () => {
  it('sets, checks and removes favorites', async () => {
    const adapter = await createMigratedDb();
    const favorites = new FavoritesRepository(adapter, () => T0);

    expect(await favorites.isFavorite('memory')).toBe(false);
    await favorites.setFavorite('memory');
    expect(await favorites.isFavorite('memory')).toBe(true);
    await favorites.removeFavorite('memory');
    expect(await favorites.isFavorite('memory')).toBe(false);
  });

  it('lists favorites newest-first and ignores duplicate sets', async () => {
    const adapter = await createMigratedDb();
    let now = T0;
    const favorites = new FavoritesRepository(adapter, () => now);

    await favorites.setFavorite('memory');
    now += 1_000;
    await favorites.setFavorite('math-fast-math');
    await favorites.setFavorite('math-fast-math'); // no-op (PK conflict ignored)

    const ids = await favorites.listFavoriteGameIds();
    expect(ids).toEqual(['math-fast-math', 'memory']);
  });

  it('removing a non-favorite is a no-op', async () => {
    const adapter = await createMigratedDb();
    const favorites = new FavoritesRepository(adapter, () => T0);
    await favorites.removeFavorite('nope');
    expect(await favorites.listFavoriteGameIds()).toEqual([]);
  });
});
