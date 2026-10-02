/**
 * Navigation-depth primitives (Change 072 §4).
 *
 * THE DEFECT THIS EXISTS TO FIX
 * -----------------------------
 * `router.push('/games')` from inside another tab does not "go to Games" — it
 * pushes a NEW entry onto the root stack. Tap Games, then Progress, then Games
 * again and the stack is Home → Games → Progress → Games. Pressing back now
 * walks through Progress and Home instead of leaving the tab you are on, and
 * every extra entry is a screen the user can re-enter with a hardware back
 * press they did not intend. The tab bar looks stateless while the stack is a
 * history, which is the worst combination: invisible and wrong.
 *
 * `router.replace` puts the destination where the current entry was, so the
 * depth is bounded by the number of DISTINCT screens the user visits rather
 * than by how many times they tap a tab.
 *
 * WHEN NOT TO USE IT
 * ------------------
 * Detail screens must still PUSH. Pushing `/game-detail/memory` and then
 * backing out to the list is exactly the behaviour a stack is for; replacing
 * would destroy the list the user came from. The rule is about *top-level*
 * destinations — the destinations a user thinks of as "a place", not as "a
 * screen I opened".
 *
 * The set is declared here rather than inferred, because a guard that guesses
 * "is this top-level?" from a string is a guard that can be fooled.
 */

import { useRouter, type Href } from 'expo-router';

/**
 * Destinations that are PLACES rather than screens.
 *
 * Each of these is either a tab or a root-level stack screen: arriving at one
 * means "the user is here now", and a second arrival should not stack a second
 * copy. `/game/[id]` and the `progress-*` detail routes are deliberately
 * absent — they are the screens a stack exists for.
 */
export const TOP_LEVEL_HREFS: readonly string[] = [
  '/',
  '/games',
  '/progress',
  '/profile',
  '/rewards',
  '/data-management',
  '/results',
  '/(tabs)',
  '/(tabs)/index',
  '/(tabs)/games',
  '/(tabs)/progress',
  '/(tabs)/profile',
  '/(tabs)/rewards',
];

/**
 * Pure predicate over a href's PATH (query and fragment stripped).
 *
 * Exported and unit-tested on its own so the classification is a decision with
 * a test, not a `startsWith` buried in a press handler.
 *
 * One deliberate query exception: `/results` is dual-purpose. Bare, it is the
 * post-completion SUMMARY — a place, entered with `replace`. With `?id=…` it is
 * one past session's RECORD — a drill-down from a history list, where `push`
 * is the correct stack behaviour and replacing would destroy the list behind
 * it. Every call site already follows this split (bare: `replace`; `?id=`:
 * push/Link), so the predicate encodes the behaviour that exists.
 */
export function isTopLevelHref(href: string): boolean {
  const raw = String(href);
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path === '/results') {
    return !/[?#]id=/.test(raw);
  }
  return TOP_LEVEL_HREFS.includes(path);
}

/**
 * Go to a TOP-LEVEL destination, replacing the current stack entry.
 *
 * Use for tab and root-level destinations. For a detail screen use
 * `router.push` — see the module note.
 */
export function useTopLevelNav(): (href: Href) => void {
  const router = useRouter();
  return (href: Href) => {
    if (isTopLevelHref(String(href))) {
      router.replace(href);
      return;
    }
    // Defensive: reaching for a detail route through this helper is a mistake,
    // and pushing it is at least the behaviour the route expects. `replace`
    // would silently destroy the screen the user is leaving.
    router.push(href);
  };
}
