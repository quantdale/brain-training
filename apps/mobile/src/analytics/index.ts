/**
 * Public surface of the Progress analytics feature. Pure aggregation functions
 * live alongside small, read-only data-loaders used by the screens. The loaders
 * only call existing `AppDatabase` query methods (no new schema, no migrations)
 * and hand already-persisted rows to the pure analytics functions.
 */

export * from './types';
export * from './format';
export * from './windows';
export * from './metrics-map';
export * from './domain-insights';
export * from './composite-explainer';
export * from './activity-calendar';
export * from './game-insights';
export * from './training-balance';
export * from './insight-notes';
export * from './queries';
// Progress V2 (campaign 010) additions:
export * from './trend-summary';
export * from './volume-view';
export * from './metric-trends';
export * from './difficulty-progression';
export * from './personal-best';
export * from './rolling-windows';
export * from './category-comparison';
export * from './workout-analytics';
export * from './cooccurrence';
