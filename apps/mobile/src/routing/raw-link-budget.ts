/** Pre-parser native link budget. Screen route envelopes run too late: Expo57
 * parseQueryParams calls getAll for EVERY key occurrence, even unknown keys.
 * Bound the raw string before decoding, then bound entries and decoded-key
 * multiplicity before any URL/URLSearchParams constructor can run.
 *
 * Current app links carry a handful of scalar identifiers (<128 chars each).
 * 8 KiB / 32 entries / 4 values per key retain ordinary links and modest array
 * params, while capping Expo's duplicate materialization at 128 total values.
 */
export const MAX_RAW_LINK_LENGTH = 8192;
export const MAX_RAW_QUERY_ENTRIES = 32;
export const MAX_RAW_QUERY_DUPLICATES = 4;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

export function budgetRawSystemPath(path: string): string {
  // Length is deliberately the first check: no scan, split, decoding or URL
  // construction is allowed on an oversized input (including unused query).
  if (typeof path !== 'string' || path.length > MAX_RAW_LINK_LENGTH) return '/';
  try {
    // Reject malformed escapes/UTF-8 and literal or encoded controls instead
    // of letting permissive URL parsing normalize them into a different link.
    if (CONTROL_CHARACTERS.test(decodeURIComponent(path))) return '/';
    const hashIndex = path.indexOf('#');
    const queryIndex = path.indexOf('?');
    if (queryIndex === -1 || (hashIndex !== -1 && hashIndex < queryIndex)) return path;
    const query = path.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex);
    if (!query) return path;
    const entries = query.split('&');
    if (entries.length > MAX_RAW_QUERY_ENTRIES) return '/';
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const separator = entry.indexOf('=');
      // Match URLSearchParams key equivalence, including percent aliases and
      // form-style plus/space. Decode only after bounding total raw work.
      const name = decodeURIComponent((separator === -1 ? entry : entry.slice(0, separator)).replace(/\+/g, ' '));
      const count = (counts.get(name) ?? 0) + 1;
      if (count > MAX_RAW_QUERY_DUPLICATES) return '/';
      counts.set(name, count);
    }
    return path;
  } catch {
    return '/';
  }
}
