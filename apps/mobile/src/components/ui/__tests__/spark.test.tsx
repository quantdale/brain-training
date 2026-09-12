/**
 * `Spark` identity-mark contract (Campaign 026 visual-QA).
 *
 * Pins the finding that sent this file here: the centre node must stay
 * visible against the bars in both themes. A same-as-bars default degraded
 * every standalone spark into a plain "+" that read as an add button across
 * profile, rewards and games heroes.
 */
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Spark } from '@/components/ui/spark';

/** Flatten the host tree into style objects, root first. */
function stylesOf(node: unknown): Record<string, unknown>[] {
  const json = node as {
    props?: { style?: unknown };
    children?: unknown[];
  } | null;
  if (!json || typeof json !== 'object') return [];
  const flat = StyleSheet.flatten(json.props?.style) as Record<string, unknown>;
  const kids = Array.isArray(json.children) ? json.children : [];
  return [flat, ...kids.flatMap((child) => stylesOf(child))];
}

describe('Spark', () => {
  it('renders a centre node that contrasts the bars by default', async () => {
    const tree = await render(<Spark size={44} color="#D6402A" />);
    const styles = stylesOf(tree.toJSON());
    // Root + two bars + core.
    expect(styles).toHaveLength(4);
    const [root, barA, barB, core] = styles;
    expect(root.width).toBe(44);
    expect(root.height).toBe(44);
    expect(barA.backgroundColor).toBe('#D6402A');
    expect(barB.backgroundColor).toBe('#D6402A');
    // The depth node is not the bar colour (the "+" regression).
    expect(core.backgroundColor).not.toBe('#D6402A');
    expect(core.backgroundColor).toBe('rgba(0, 0, 0, 0.32)');
  });

  it('honours an explicit core colour', async () => {
    const tree = await render(<Spark size={32} color="#D6402A" coreColor="#FFFFFF" />);
    const styles = stylesOf(tree.toJSON());
    expect(styles[3].backgroundColor).toBe('#FFFFFF');
  });

  it('scales bars and node from the size prop', async () => {
    const tree = await render(<Spark size={40} color="#D6402A" />);
    const styles = stylesOf(tree.toJSON());
    const [, barA, , core] = styles;
    expect(barA.width).toBe(40);
    expect(barA.height).toBe(Math.max(3, Math.round(40 * 0.22)));
    const dot = Math.max(4, Math.round(40 * 0.3));
    expect(core.width).toBe(dot);
    expect(core.height).toBe(dot);
    expect(core.borderRadius).toBe(dot / 2);
  });
});
