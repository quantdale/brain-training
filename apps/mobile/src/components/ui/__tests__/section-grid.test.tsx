/**
 * `SectionGrid` primitive contract (071 §6.1 shared-kit coverage debt).
 *
 * Pins the adaptive-layout mechanism: phone viewports stay stacked (a 2-up
 * phone layout reads as clutter), wide non-compact viewports flow children
 * into columns wrapped per child with the requested `flexBasis`, the gap lands
 * on both axes, and a single non-array child still gets the wrapper so the
 * caller never needs layout knowledge.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';

import { SectionGrid } from '@/components/ui/section-grid';
import { Spacing } from '@/theme/tokens';

const mockCompact = jest.fn<() => boolean>(() => true);
const mockWide = jest.fn<() => boolean>(() => false);
jest.mock('@/platform/layout', () => ({
  useIsCompactWidth: () => mockCompact(),
  useIsWideWidth: () => mockWide(),
}));

/** Flattened style of the grid root. */
function rootStyle(tree: Awaited<ReturnType<typeof render>>): Record<string, unknown> {
  const json = tree.toJSON() as { props?: { style?: unknown } } | null;
  return (StyleSheet.flatten(json?.props?.style) ?? {}) as Record<string, unknown>;
}

/** Flattened styles of the grid root's direct children (cells when split). */
function childStyles(tree: Awaited<ReturnType<typeof render>>): Record<string, unknown>[] {
  const json = tree.toJSON() as { children?: { props?: { style?: unknown } }[] } | null;
  const kids = Array.isArray(json?.children) ? json!.children! : [];
  return kids.map(
    (child) => (StyleSheet.flatten(child.props?.style) ?? {}) as Record<string, unknown>,
  );
}

describe('SectionGrid', () => {
  it('stays stacked (column) on a phone viewport even when tiles would fit', async () => {
    mockCompact.mockReturnValue(true);
    mockWide.mockReturnValue(false);
    const tree = await render(
      <SectionGrid>
        <Text>A</Text>
        <Text>B</Text>
      </SectionGrid>,
    );
    expect(rootStyle(tree).flexDirection).toBe('column');
    // Stacked children are rendered as-is: none of them is a wrapper cell
    // (the cell signature is the flexBasis the split path injects).
    for (const child of childStyles(tree)) {
      expect(child.flexBasis).toBeUndefined();
    }
  });

  it('splits into columns on a wide non-compact viewport', async () => {
    mockCompact.mockReturnValue(false);
    mockWide.mockReturnValue(true);
    const tree = await render(
      <SectionGrid>
        <Text>A</Text>
        <Text>B</Text>
        <Text>C</Text>
      </SectionGrid>,
    );
    expect(rootStyle(tree).flexDirection).toBe('row');
    expect(rootStyle(tree).flexWrap).toBe('wrap');
    // One wrapper cell per child, each with the default basis.
    const cells = childStyles(tree);
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      expect(cell.flexBasis).toBe(320);
    }
  });

  it('honours a custom minColumnWidth for the cell basis', async () => {
    mockCompact.mockReturnValue(false);
    mockWide.mockReturnValue(true);
    const tree = await render(
      <SectionGrid minColumnWidth={240}>
        <Text>A</Text>
        <Text>B</Text>
      </SectionGrid>,
    );
    for (const cell of childStyles(tree)) {
      expect(cell.flexBasis).toBe(240);
    }
  });

  it('wraps a single non-array child in a cell when split', async () => {
    mockCompact.mockReturnValue(false);
    mockWide.mockReturnValue(true);
    const tree = await render(
      <SectionGrid>
        <Text>Only</Text>
      </SectionGrid>,
    );
    expect(rootStyle(tree).flexDirection).toBe('row');
    expect(childStyles(tree)).toHaveLength(1);
  });

  it('applies the gap to both axes and a custom gap overrides it', async () => {
    mockCompact.mockReturnValue(false);
    mockWide.mockReturnValue(true);
    const tree = await render(
      <SectionGrid>
        <Text>A</Text>
        <Text>B</Text>
      </SectionGrid>,
    );
    expect(rootStyle(tree).rowGap).toBe(Spacing.three);
    expect(rootStyle(tree).columnGap).toBe(Spacing.three);

    const custom = await render(
      <SectionGrid gap={12}>
        <Text>A</Text>
        <Text>B</Text>
      </SectionGrid>,
    );
    expect(rootStyle(custom).rowGap).toBe(12);
    expect(rootStyle(custom).columnGap).toBe(12);
  });

  it('keeps cells growable and shrinkable so uneven cards stay readable', async () => {
    mockCompact.mockReturnValue(false);
    mockWide.mockReturnValue(true);
    const tree = await render(
      <SectionGrid>
        <Text>A</Text>
        <Text>B</Text>
      </SectionGrid>,
    );
    for (const cell of childStyles(tree)) {
      expect(cell.flexGrow).toBe(1);
      expect(cell.flexShrink).toBe(1);
    }
  });
});
