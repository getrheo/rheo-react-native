import { beforeEach, describe, expect, it } from 'vitest';
import type { SdkResolveResponse } from '@getrheo/contracts';
import {
  clearManifestResolveCacheMemoryForTests,
  clearManifestResolveCache,
  listManifestResolveCacheEntries,
  loadManifestResolveCache,
  manifestResolveCacheKey,
  parseManifestResolveCacheKey,
  peekManifestResolveCache,
  saveManifestResolveCache,
  shouldSendManifestConditional,
} from './manifestResolveCache.js';

const sampleBody = (): SdkResolveResponse =>
  ({
    flowId: '00000000-0000-4000-8000-000000000001',
    versionId: '00000000-0000-4000-8000-000000000002',
    versionNumber: 1,
    assignmentVersion: 3,
    environment: 'test',
    channelId: 'ch_test_1',
    experimentId: null,
    variantId: null,
    manifest: { version: 1, screens: [], theme: null },
    mediaMap: {},
    integrations: {},
  }) as unknown as SdkResolveResponse;

describe('manifestResolveCache', () => {
  beforeEach(() => {
    clearManifestResolveCacheMemoryForTests();
  });

  it('builds a stable cache key', () => {
    expect(
      manifestResolveCacheKey('https://api.test/', 'ob_pk_x', 'ch_abc'),
    ).toBe(manifestResolveCacheKey('https://api.test', 'ob_pk_x', 'ch_abc'));
  });

  it('keys by locale so locale changes do not read a stale manifest', () => {
    const en = manifestResolveCacheKey('https://api.test', 'ob_pk_x', 'ch_abc', 'en');
    const fr = manifestResolveCacheKey('https://api.test', 'ob_pk_x', 'ch_abc', 'fr');
    expect(en).not.toBe(fr);
    // Missing locale is treated as the empty-locale segment, stable across calls.
    expect(manifestResolveCacheKey('https://api.test', 'ob_pk_x', 'ch_abc')).toBe(
      manifestResolveCacheKey('https://api.test', 'ob_pk_x', 'ch_abc', ''),
    );
  });

  it('gates conditional requests on a validated entry', () => {
    expect(shouldSendManifestConditional(null)).toBe(false);
    expect(shouldSendManifestConditional({ etag: '', body: sampleBody(), cachedAt: 0 })).toBe(
      false,
    );
    expect(
      shouldSendManifestConditional({ etag: '"1-uuid"', body: sampleBody(), cachedAt: 0 }),
    ).toBe(true);
  });

  it('round-trips save and load through memory and AsyncStorage', async () => {
    const key = manifestResolveCacheKey('https://api.test', 'ob_pk', 'ch_1');
    const entry = { etag: '"3-uuid"', body: sampleBody(), cachedAt: 1 };
    await saveManifestResolveCache(key, entry);
    clearManifestResolveCacheMemoryForTests();
    const loaded = await loadManifestResolveCache(key);
    expect(loaded?.etag).toBe('"3-uuid"');
    expect(loaded?.body.flowId).toBe(entry.body.flowId);
  });

  it('peekManifestResolveCache reads memory without disk', async () => {
    const key = manifestResolveCacheKey('https://api.test', 'ob_pk', 'ch_peek');
    await saveManifestResolveCache(key, { etag: '"1-a"', body: sampleBody(), cachedAt: 0 });
    expect(peekManifestResolveCache(key)?.etag).toBe('"1-a"');
  });

  it('parseManifestResolveCacheKey round-trips manifestResolveCacheKey', () => {
    const key = manifestResolveCacheKey('https://api.test', 'ob_pk_x', 'ch_abc', 'en');
    expect(parseManifestResolveCacheKey(key)).toEqual({
      apiBaseUrl: 'https://api.test',
      publishableKey: 'ob_pk_x',
      channelId: 'ch_abc',
      locale: 'en',
    });
  });

  it('lists and clears manifest cache entries', async () => {
    const key = manifestResolveCacheKey('https://api.test', 'ob_pk', 'ch_list', 'en');
    await saveManifestResolveCache(key, { etag: '"1-a"', body: sampleBody(), cachedAt: 42 });
    const listed = await listManifestResolveCacheEntries();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.channelId).toBe('ch_list');
    expect(listed[0]?.etag).toBe('"1-a"');
    const removed = await clearManifestResolveCache();
    expect(removed).toBe(1);
    expect(await listManifestResolveCacheEntries()).toHaveLength(0);
  });
});
