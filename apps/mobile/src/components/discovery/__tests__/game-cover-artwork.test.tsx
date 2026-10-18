import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { registry } from '@/registry/registry.generated';
import { GAME_COVERS } from '../game-cover-artwork.generated';
import { getGameCover } from '../game-cover-artwork';
import { GameWorldArt } from '../game-identity';

const assetDir = path.resolve(__dirname, '../../../../assets/game-covers');
const inventory = JSON.parse(fs.readFileSync(path.join(assetDir, 'inventory.json'), 'utf8'));

describe('registered mechanic cover contract', () => {
  it('keeps authored scenes, local assets, label mapping and review sheets deterministic', () => {
    const root = path.resolve(__dirname, '../../../../../..');
    expect(() => execFileSync(process.execPath, ['scripts/artwork/generate-covers.mjs', '--check'], {
      cwd: root, stdio: 'pipe', timeout: 10_000,
    })).not.toThrow();
  });
  it('maps all 42 stable IDs, without extra IDs, missing assets or duplicate image content', () => {
    const ids = registry.map(game => game.id).sort();
    expect(ids).toHaveLength(42);
    expect(Object.keys(GAME_COVERS).sort()).toEqual(ids);
    expect(inventory.entries.map((entry: { id: string }) => entry.id).sort()).toEqual(ids);
    const hashes = new Set<string>();
    for (const game of registry) {
      const cover = getGameCover(game.id)!;
      const bytes = fs.readFileSync(path.join(assetDir, `${game.id}.png`));
      const entry = inventory.entries.find((item: { id: string }) => item.id === game.id);
      expect(cover.source).toBeDefined();
      expect(cover.concept.length).toBeGreaterThan(20);
      expect(bytes.subarray(1, 4).toString()).toBe('PNG');
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([512, 320]);
      expect(bytes.length).toBeLessThan(100_000);
      const hash = createHash('sha256').update(bytes).digest('hex');
      expect(hash).toBe(entry.sha256);
      hashes.add(hash);
      for (const label of cover.labels) {
        expect(label.x).toBeGreaterThan(0);
        expect(label.x).toBeLessThan(320);
        expect(label.y).toBeGreaterThan(0);
        expect(label.y).toBeLessThan(200);
      }
    }
    expect(hashes.size).toBe(42);
    expect(inventory.entries.reduce((sum: number, entry: { bytes: number }) => sum + entry.bytes, 0)).toBeLessThan(1_000_000);
  });

  it('uses the same local identity at all sizes, with fixed aspect ratio and decorative input semantics', async () => {
    const game = registry.find(item => item.id === 'spatial-fold-match')!;
    for (const [size, height] of [['card', 112], ['hero', 120], ['stage', 180], ['thumbnail', 64]] as const) {
      const result = await render(<GameWorldArt game={game} size={size} testID="cover" />);
      const frame = result.getByTestId('cover', { includeHiddenElements: true });
      expect(frame.props.pointerEvents).toBe('none');
      expect(frame.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(StyleSheet.flatten(frame.props.style).height).toBe(height);
      expect(StyleSheet.flatten(result.getByTestId('cover-artwork-frame', { includeHiddenElements: true }).props.style))
        .toMatchObject({ width: '100%', aspectRatio: 1.6, maxWidth: height * 1.6 });
      const art = result.getByTestId('cover-artwork', { includeHiddenElements: true });
      expect(art.props.source).toBe(getGameCover(game.id)!.source);
      expect(art.props.resizeMode).toBe('contain');
      expect(art.props.fadeDuration).toBe(0);
      await result.unmount();
    }
  });

  it('does not substitute domain artwork for an unknown ID', () => {
    for (const id of ['fixture-spatial', 'constructor', 'toString', '__proto__']) {
      expect(getGameCover(id)).toBeUndefined();
    }
  });
});
