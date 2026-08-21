/**
 * Shell a11y source contract (W12) — static guard over ALL W12-owned shell
 * surfaces, so a new control cannot land without its accessibility contract:
 *
 * - every `<Pressable` must carry an explicit `accessibilityRole`
 *   (interactive elements are announced correctly; non-interactive layout
 *   should use `View`, which this rule pushes authors toward);
 * - every `<TextInput` / `<Switch` must carry an `accessibilityLabel`
 *   (inputs have no visible text label in this shell).
 *
 * Counting-based on purpose: it is robust to multi-line JSX props and arrow
 * functions inside handlers, and it fails loudly when a file is renamed or a
 * new unlabelled control appears. Rendered behavior contracts live in
 * `src/components/__tests__/shell-a11y.test.tsx`.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..'); // apps/mobile/src

/** Every W12-owned write surface (packet W12.md), relative to `src/`. Renames must update this list. */
const OWNED_SURFACES: string[] = [
  'components/screen-shell.tsx',
  'components/app-tabs.tsx',
  'components/app-tabs.web.tsx',
  'components/themed-text.tsx',
  'components/themed-view.tsx',
  'components/error-boundary.tsx',
  'components/game-not-ready.tsx',
  'components/settings/settings-provider.tsx',
  'components/sensory/audio-haptics-provider.tsx',
  'components/sensory/sensory-settings-card.tsx',
  'app/(tabs)/games.tsx',
  'app/(tabs)/profile.tsx',
  'app/game/[id].tsx',
  'app/game-detail/[id].tsx',
  'app/data-management.tsx',
  'app/storage-unavailable.tsx',
  'app/results.tsx',
];

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('owned shell surfaces a11y source contract', () => {
  const sources = new Map<string, string>(
    OWNED_SURFACES.map((rel) => [rel, readFileSync(path.join(SRC, rel), 'utf8')]),
  );

  it('finds every owned surface (a rename must update this audit list)', () => {
    expect(sources.size).toBe(OWNED_SURFACES.length);
  });

  it.each(OWNED_SURFACES)('%s: every Pressable declares an accessibilityRole', (rel) => {
    const source = sources.get(rel)!;
    expect(countOccurrences(source, '<Pressable')).toBeLessThanOrEqual(
      countOccurrences(source, 'accessibilityRole='),
    );
  });

  it.each(OWNED_SURFACES)('%s: every TextInput/Switch declares an accessibilityLabel', (rel) => {
    const source = sources.get(rel)!;
    const inputs = countOccurrences(source, '<TextInput') + countOccurrences(source, '<Switch');
    expect(inputs).toBeLessThanOrEqual(countOccurrences(source, 'accessibilityLabel='));
  });
});
