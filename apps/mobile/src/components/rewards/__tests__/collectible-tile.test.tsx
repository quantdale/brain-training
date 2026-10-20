/**
 * CollectibleTile text-integrity regression (explore finding F-10b).
 *
 * The 077 native visual review recorded a truncated secondary Bronze Ring
 * unlock hint at expanded width: a React Native Text without `flexShrink`
 * inside a bounded plinth clips instead of wrapping. These tests pin the
 * wrap-not-clip contract on the exact cosmetic the review flagged: the full
 * name and unlock line must render, and both lines must carry the anti-clip
 * style (`alignSelf: 'stretch'` + `flexShrink: 1`).
 */
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { COSMETIC_DEFINITIONS } from '@/cosmetics/registry';
import { CollectibleTile } from '../collectible-tile';

// A factory keeps the non-undefined narrowing: a bare `find()` narrowed by a
// module-level guard loses it again inside `renderBronze` (TS18048).
function requireBronze() {
  const found = COSMETIC_DEFINITIONS.find((def) => def.id === 'cos-frame-bronze');
  if (!found) {
    throw new Error('cos-frame-bronze fixture missing from cosmetics registry');
  }
  return found;
}
const BRONZE = requireBronze();
/** The authored unlock copy for Bronze Ring ("Earned by completing 25 sessions."). */
const BRONZE_HINT = BRONZE.description;

async function renderBronze(detail: string = BRONZE_HINT) {
  return render(
    <CollectibleTile
      name={BRONZE.name}
      slot={BRONZE.slot}
      preview={BRONZE.preview}
      state="locked"
      detail={detail}
      testID="collectible-bronze"
    />,
  );
}

describe('CollectibleTile text integrity (F-10b regression)', () => {
  it('renders the full Bronze Ring name and unlock hint', async () => {
    const view = await renderBronze();
    expect(view.getByText('Bronze Ring')).toBeOnTheScreen();
    expect(view.getByText(BRONZE_HINT)).toBeOnTheScreen();
  });

  it('wraps (never clips) the name and secondary line at any width', async () => {
    const view = await renderBronze();
    for (const text of ['Bronze Ring', BRONZE_HINT]) {
      expect(view.getByText(text)).toHaveStyle({ alignSelf: 'stretch', flexShrink: 1 });
    }
  });

  it('renders a long unlock hint in full (no truncation configuration)', async () => {
    const longHint = 'Earned by completing 25 sessions. Keep training to grow your collection further.';
    const view = await renderBronze(longHint);
    const node = view.getByText(longHint);
    expect(node).toBeOnTheScreen();
    expect(node.props.numberOfLines).toBeUndefined();
    expect(node.props.ellipsizeMode).toBeUndefined();
    expect(node).toHaveStyle({ alignSelf: 'stretch', flexShrink: 1 });
  });
});
