// Wave-0 scaffold smoke test: proves the jest-expo pipeline (ts + babel) works.
// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { expect, test } from '@jest/globals';

test('jest infra is operational', () => {
  expect(2 + 2).toBe(4);
});
