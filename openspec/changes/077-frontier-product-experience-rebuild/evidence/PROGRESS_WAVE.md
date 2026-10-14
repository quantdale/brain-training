# Progress presentation wave

Source implementation covers the overview, Training history, domain, per-game
and activity routes. It preserves analytics/rating/storage calculations and
existing semantic IDs. Native visual acceptance remains open.

## Reference decisions

The supplementary read-only investigation made six successful Refero calls:
two iOS screen searches (training progress/statistics/overall score/activity,
and personal activity/calendar/history), one Markdown screen batch and three
full image fetches. Inspected screen IDs:

- Clearful light Progress: c97a590a-59aa-4206-86f1-e6456f051ac7, app140.
- Clearful dark Progress: 0bdd9604-5207-419b-b21d-9d03cab7b0fb, app140.
- GrowPal History: 37f05fa5-6918-4934-b8ed-239c4272f6dc, app141.

Adopt direct metric context, a clear primary summary and scannable history.
Reject the dark low-contrast blue, oversized chart framing and repeated equal
tiles. The existing Quizlet/Play Lab reference lock remains the dominant visual
direction. These call records were inspected in the research agent's actual
tool history; supplementary raw responses were not saved to disk. The earlier
Refero JSON files do not contain these three IDs and are not claimed to do so.

## Resulting behavior

- Overview leads with the current overall rating and separately names normalized
  performance differences. It keeps activity, eight domains and useful recent
  context visible; advanced reports expand through More insights.
- Training history exposes the loaded-session/update bounds (up to120 each),
  readable lists, an empty Browse games action and bounded domain history
  disclosure. All-time game records are labeled separately from loaded history.
- Domain details distinguish current rating, freshness and selected-window
  evidence. Displayed trend slope now uses rating points/day correctly; a
  two-point/day fixture formerly displayed200. Underlying ratings are unchanged.
- Per-game records wrap at compact/2× and disclose the actual recent comparison
  window; All uses a labeled90-day recent side, preserving its existing data.
- Activity uses responsive columns/stacked evidence with full titles rather
  than a fixed four-column fragment at large text.

The routes use the existing shared ReportRow/ListRow; root added unclamped
essential text, automatic compact/large-text stacking and vector chevrons there.
No second row/control library was introduced.

## Validation

Focused route/analytics callers: five suites,40 tests PASS, including actual
7d/30d/All values, rating vs performance separation, window facts, compact/2×
layouts, bounded disclosure and correct slope. A final empty-history action
change was rechecked with Training history4/4 PASS. Owned lint had zero warnings;
project TypeScript exited0. Root combined/current-source checks remain separate.

The first transferred analytics suite failed two old immediate-disclosure/copy
assertions. Updated callers explicitly open More insights before checking the
preserved advanced sections; no calculation expectation was weakened. This is
source/caller evidence, not screenshot acceptance or owner taste approval.
