/**
 * Tab model test — the four shell tabs and their stable semantic testIDs
 * (PROJECT_CONSTITUTION §29; task packet 001-a completion criteria).
 */

// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';

import { TAB_DEFINITIONS } from '@/constants/tabs';

describe('tab model', () => {
  it('defines exactly the four shell tabs', () => {
    expect(TAB_DEFINITIONS.map((tab) => tab.name)).toEqual([
      'index',
      'games',
      'progress',
      'profile',
    ]);
  });

  it('assigns the stable semantic testIDs', () => {
    const ids = TAB_DEFINITIONS.map((tab) => tab.testID).sort();
    expect(ids).toEqual(['tab-games', 'tab-home', 'tab-profile', 'tab-progress']);
  });

  it('gives every tab a label, icons and a web href', () => {
    for (const tab of TAB_DEFINITIONS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.sf.length).toBeGreaterThan(0);
      expect(tab.md.length).toBeGreaterThan(0);
      expect(tab.web.length).toBeGreaterThan(0);
      expect(tab.href.startsWith('/')).toBe(true);
    }
  });

  it('keeps testIDs unique', () => {
    const ids = TAB_DEFINITIONS.map((tab) => tab.testID);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
