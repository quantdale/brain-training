/** Installed Expo57 cold/warm linking harness, not a screen-param mock.
 * Absence of +native-intent reproduces the unguarded application baseline. */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Platform } from 'react-native';
import { Platform as ExpoPlatform } from 'expo-modules-core';
import { getLinkingConfig } from 'expo-router/build/getLinkingConfig';
import { parseQueryParams } from 'expo-router/build/fork/getStateFromPath-forks';
import type { RouteNode } from 'expo-router/build/Route';
import type { UrlObject } from 'expo-router/build/global-state/getRouteInfoFromState';
import type { RequireContext } from 'expo-router/build/types';

let mockInitialPath: string | Promise<string> = '/';
let mockWarmListener: ((event: { url: string }) => Promise<void>) | undefined;
const mockRemove = jest.fn();
jest.mock('expo-linking', () => ({
  addEventListener: jest.fn((_event: string, listener: typeof mockWarmListener) => {
    mockWarmListener = listener;
    return { remove: mockRemove };
  }),
}));
jest.mock('expo-router/build/link/linking', () => {
  const actual = jest.requireActual('expo-router/build/link/linking') as object;
  return { ...actual, getInitialURL: () => mockInitialPath };
});

const nativeIntentFile = resolve(__dirname, '../../app/+native-intent.tsx');
function config() {
  const nativeIntentPresent = existsSync(nativeIntentFile);
  const context = Object.assign((key: string) => {
    if (key === './+native-intent.tsx') {
      // The exact on-disk route module Expo discovers via the context key.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../../app/+native-intent');
    }
    throw new Error('Unexpected context key: ' + key);
  }, { keys: () => nativeIntentPresent ? ['./+native-intent.tsx'] : [], resolve: (key: string) => key, id: 'native-intent-test' }) as RequireContext;
  const child = (route: string): RouteNode => ({ type: 'route', route, contextKey: './' + route + '.tsx', loadRoute: () => ({}), dynamic: null, children: [] });
  const routes: RouteNode = { type: 'layout', route: '', contextKey: './_layout.tsx', loadRoute: () => ({}), dynamic: null,
    children: ['index', 'results', 'game/[id]', 'game-detail/[id]', 'progress-domain', 'data-management'].map(child) };
  return getLinkingConfig(routes, context, () => ({ segments: [] }) as unknown as UrlObject,
    { skipGenerated: true, sitemap: false, notFound: false });
}
function stateFor(linking: ReturnType<typeof config>, path: string) {
  return linking.getStateFromPath(path, linking.config);
}
function spyQueryWork() {
  let materializedValues = 0;
  const original = URLSearchParams.prototype.getAll;
  const spy = jest.spyOn(URLSearchParams.prototype, 'getAll').mockImplementation(function (this: URLSearchParams, key: string) {
    const values = original.call(this, key);
    materializedValues += values.length;
    return values;
  });
  return { spy, values: () => materializedValues };
}
afterEach(() => { jest.restoreAllMocks(); mockWarmListener = undefined; mockRemove.mockClear(); });

describe('Expo57 raw native-intent entry', () => {
  it.each([256, 1024, 4096])('independently reproduces upstream quadratic duplicate work for %i entries', (count) => {
    const work = spyQueryWork();
    parseQueryParams('/results?' + Array(count).fill('x=a').join('&'), { name: 'results' });
    expect(work.spy).toHaveBeenCalledTimes(count);
    expect(work.values()).toBe(count * count);
  });

  it('discovers a top-level native-intent route and bounds before any URL parser', () => {
    expect(existsSync(nativeIntentFile)).toBe(true);
    const linking = config();
    mockInitialPath = 'braintraining://results?' + 'x=a&'.repeat(100_000);
    const urlConstructor = jest.spyOn(globalThis, 'URL');
    const decoder = jest.spyOn(globalThis, 'decodeURIComponent');
    expect(linking.getInitialURL?.()).toBe('/');
    expect(urlConstructor).not.toHaveBeenCalled();
    expect(decoder).not.toHaveBeenCalled();
  });

  it.each([false, true])('cold native hook rejects duplicate-budget abuse before query parsing (async=%s)', async (asyncInitial) => {
    const path = 'braintraining://results?' + Array(256).fill('x=a').join('&');
    mockInitialPath = asyncInitial ? Promise.resolve(path) : path;
    const work = spyQueryWork();
    const linking = config();
    const href = await linking.getInitialURL?.();
    expect(href).toBe('/');
    expect(stateFor(linking, href!)).toBeDefined();
    expect(work.spy).not.toHaveBeenCalled();
  });

  it('warm native hook guards events before the listener/parser and removes its subscription', async () => {
    const linking = config();
    const work = spyQueryWork();
    const listener = jest.fn((path: string) => { stateFor(linking, path); });
    const unsubscribe = linking.subscribe!(listener);
    await mockWarmListener!({ url: 'braintraining://results?' + Array(256).fill('x=a').join('&') });
    expect(listener).toHaveBeenCalledWith('/');
    expect(work.spy).not.toHaveBeenCalled();
    if (typeof unsubscribe === 'function') unsubscribe();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/results?x=%', '/results?x=%GG', '/results?x=%C0%AF',
    '/results?x=%00', '/results?x=%0a', '/results?x=\u0001',
    '/results?' + Array.from({ length: 33 }, (_, i) => `k${i}=a`).join('&'),
    '/results?x=a&%78=b&x=c&%78=d&x=e',
    '/results?x=' + 'a'.repeat(8192),
  ])('rejects malformed/control/over-budget query case %#', async (path) => {
    mockInitialPath = path;
    expect(await config().getInitialURL?.()).toBe('/');
  });

  it.each([
    '/', '/data-management', '/game/memory-sequence-memory?seed=123',
    '/game-detail/memory-sequence-memory',
    '/results?sessionId=memory-sequence-memory-abc-1-xy&workoutKey=2026-11-16%3A%3Adaily%3A%3Astandard&workoutIndex=3',
    '/progress-domain?domain=Logic+%26+Problem+Solving',
    '/progress-domain?domain=Logic%20%26%20Problem%20Solving',
    '/results?x=a&x=b',
  ])('preserves legitimate route bytes and real navigation state: %s', async (path) => {
    mockInitialPath = path;
    const linking = config();
    const href = await linking.getInitialURL?.();
    expect(href).toBe(path);
    expect(stateFor(linking, href!)).toBeDefined();
  });

  it('accepts exact length, entry and decoded-duplicate boundaries', async () => {
    const paths = [
      '/results?x=' + 'a'.repeat(8192 - '/results?x='.length),
      '/results?' + Array.from({ length: 32 }, (_, i) => `k${i}=a`).join('&'),
      '/results?a+b=1&a%20b=2&%61+b=3&a+b=4',
    ];
    for (const path of paths) {
      mockInitialPath = path;
      const linking = config();
      const href = await linking.getInitialURL?.();
      expect(href).toBe(path);
      expect(stateFor(linking, href!)).toBeDefined();
    }
    mockInitialPath = paths[2] + '&a%20b=5';
    expect(await config().getInitialURL?.()).toBe('/');
  });

  it('preserves absolute native links on cold and warm hooks', async () => {
    const path = 'braintraining://game/memory-sequence-memory?seed=123';
    mockInitialPath = path;
    const linking = config();
    expect(await linking.getInitialURL?.()).toBe(path);
    const listener = jest.fn();
    const unsubscribe = linking.subscribe!(listener);
    await mockWarmListener!({ url: path });
    expect(listener).toHaveBeenCalledWith(path);
    if (typeof unsubscribe === 'function') unsubscribe();
  });

  it('documents the actual web bypass: native-intent is NOT a web pre-parser guard', async () => {
    jest.replaceProperty(ExpoPlatform, 'OS', 'web');
    jest.replaceProperty(Platform, 'OS', 'web');
    const path = '/results?' + Array(64).fill('x=a').join('&');
    mockInitialPath = path;
    const linking = config();
    const href = await linking.getInitialURL?.();
    expect(href).toBe(path); // Upstream web entry never calls redirectSystemPath.
    const work = spyQueryWork();
    stateFor(linking, href!);
    expect(work.values()).toBe(64 * 64);
    const source = readFileSync(resolve(__dirname, '../../app/+native-intent.tsx'), 'utf8');
    expect(source).toMatch(/web/i);
    expect(source).toMatch(/server|hosting/i);
  });
});
