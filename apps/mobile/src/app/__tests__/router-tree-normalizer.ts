/**
 * Deterministic normalization seam for expo-router router-tree snapshots.
 *
 * WHY THIS EXISTS: expo-router's NativeTabs host stamps every tab screen with
 * a react-navigation route `key` of the shape `<routeName>-<random id>` (the
 * random half comes from react-navigation's key generator, not our code). The
 * value surfaces in the rendered tree as `screenKey` on each
 * `RNSTabsScreenIOS`/`RNSTabsScreenAndroid` node and as
 * `navStateRequest.selectedScreenKey` on the host — different on every render,
 * which made router-tree snapshots non-deterministic (see KNOWN_ISSUES.md,
 * "NativeTabs snapshot instability") and forced the canary baselines to render
 * bare routes without any tab shell.
 *
 * HOW IT WORKS: this serializer rewrites ONLY values under known-volatile
 * key-bearing prop names (`screenKey`, `selectedScreenKey`, `screenId` — by
 * construction these carry react-navigation route keys, never user data). The
 * random id uses an alphabet that itself contains `-`, so the route name and
 * the id CANNOT be separated reliably; instead each DISTINCT raw key seen in a
 * single tree is mapped to a stable positional placeholder (`route-key-1`,
 * `route-key-2`, ...). Equal keys stay equal in the output, so selection
 * wiring (`navStateRequest.selectedScreenKey` === the focused screen's
 * `screenKey`) is still provable, and every other prop on the same nodes
 * (title, icon, tabBarItemTestID, ...) identifies WHICH route it is.
 *
 * Scope: test-only helper for snapshot tests. Never import from app code.
 */

/** Props that carry react-navigation route keys into the host tree. */
const VOLATILE_KEY_PROPS = new Set([
  'screenKey',
  'selectedScreenKey',
  'screenId',
]);

/**
 * Recursively normalize a JSON-serializable render tree. `keyPlaceholders`
 * must live for exactly ONE normalization pass (per snapshot assertion) so
 * placeholder numbering restarts deterministically per tree.
 */
export function normalizeRouterTree(node: unknown): unknown {
  const keyPlaceholders = new Map<string, string>();
  const walk = (inner: unknown): unknown => {
    if (Array.isArray(inner)) {
      return inner.map((child) => walk(child));
    }
    if (inner !== null && typeof inner === 'object') {
      const out: Record<string, unknown> = {};
      for (const [prop, value] of Object.entries(inner)) {
        if (VOLATILE_KEY_PROPS.has(prop) && typeof value === 'string') {
          let placeholder = keyPlaceholders.get(value);
          if (placeholder === undefined) {
            placeholder = `route-key-${keyPlaceholders.size + 1}`;
            keyPlaceholders.set(value, placeholder);
          }
          out[prop] = placeholder;
        } else {
          out[prop] = walk(value);
        }
      }
      return out;
    }
    return inner;
  };
  return walk(node);
}
