import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SdkResolveResponse } from '@getrheo/contracts';
import {
  clearManifestResolveCacheMemoryForTests,
  loadManifestResolveCache,
  manifestResolveCacheKey,
} from './manifestResolveCache.js';
import { resolveAllManifests } from './resolveAllManifests.js';

const entry = (channelId: string, assignmentVersion: number, versionId: string): SdkResolveResponse =>
  ({
    flowId: '00000000-0000-4000-8000-000000000001',
    versionId,
    versionNumber: 1,
    assignmentVersion,
    environment: 'test',
    channelId,
    experimentId: null,
    variantId: null,
    manifest: { version: 1, screens: [], theme: null },
    mediaMap: {},
    integrations: {},
  }) as unknown as SdkResolveResponse;

const config = {
  apiBaseUrl: 'https://api.test',
  publishableKey: 'ob_pk_test',
  userId: 'user-1',
  locale: 'en',
} as const;

describe('resolveAllManifests', () => {
  beforeEach(() => {
    clearManifestResolveCacheMemoryForTests();
  });

  it('writes every channel through to the cache with a reconstructed ETag', async () => {
    const channels = [entry('ch_a', 3, 'ver-a'), entry('ch_b', 7, 'ver-b')];
    const fetchMock = vi.fn(async () =>
      Response.json({ channels }, { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await resolveAllManifests({
      apiBaseUrl: config.apiBaseUrl,
      publishableKey: config.publishableKey,
      config: config as never,
      fetcher: fetchMock,
    });
    expect(result).toHaveLength(2);

    const a = await loadManifestResolveCache(
      manifestResolveCacheKey(config.apiBaseUrl, config.publishableKey, 'ch_a', config.locale),
    );
    expect(a?.etag).toBe('"3-ver-a"');
    expect(a?.body.channelId).toBe('ch_a');

    const b = await loadManifestResolveCache(
      manifestResolveCacheKey(config.apiBaseUrl, config.publishableKey, 'ch_b', config.locale),
    );
    expect(b?.etag).toBe('"7-ver-b"');
  });

  it('posts to /v1/sdk/resolve-all without a channel header', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ channels: [] }, { status: 200 }),
    ) as unknown as typeof fetch;
    await resolveAllManifests({
      apiBaseUrl: config.apiBaseUrl,
      publishableKey: config.publishableKey,
      config: config as never,
      fetcher: fetchMock,
    });
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://api.test/v1/sdk/resolve-all');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-rheo-channel']).toBeUndefined();
  });
});
