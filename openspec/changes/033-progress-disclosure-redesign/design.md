# Design — Campaign 033

## Overview composition

The existing window selector remains the source of context. Returning players
receive a compact `At a glance` card with three answer sections: consistency,
recorded movement, and next consideration. The composite, domain summaries,
activity, game history, and advanced analytics remain below or behind their
existing routes.

## Evidence rules

- Consistency counts completed sessions and distinct UTC training days in the
  selected window; `all` uses all stored sessions.
- Movement is empty with no selected sessions, insufficient with one selected
  session, and narrated only with at least two. Bounded windows compare their
  average with the lifetime average; all-time compares first and latest.
- The next consideration prioritizes untrained, then stale, then least-practiced
  domains using existing domain and balance results. It is not a ranking of
  intelligence, health, or ability.
- Empty players see an explanatory initial-rating card rather than a score hero.

## Accessibility and ownership

The focus action has a stable test ID, accessible label, hint, and existing
domain-detail destination. Progress Detail static evidence rows explicitly use
the 44dp minimum vertical rhythm. No route ownership is removed or rewritten.

