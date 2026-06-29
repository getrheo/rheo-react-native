import type { SdkResolveResponse } from '@getrheo/contracts';
import { mapChannelError } from '../client.js';
import { getResolvedAppUserId } from '../events.js';
import type { useRheo } from '../client.js';
import {
  loadManifestResolveCache,
  manifestResolveCacheKey,
  saveManifestResolveCache,
  shouldSendManifestConditional,
} from './manifestResolveCache.js';

type RheoConfig = ReturnType<typeof useRheo>;

export type ResolveManifestParams = {
  apiBaseUrl: string;
  publishableKey: string;
  channelId: string;
  config: RheoConfig;
  fetcher?: typeof fetch;
};

const parseEtag = (response: Response): string | null => {
  const raw = response.headers.get('etag') ?? response.headers.get('ETag');
  if (!raw?.trim()) return null;
  return raw.trim();
};

/**
 * Concurrent resolves for the same channel + locale (e.g. provider prefetch and
 * a `Flow` mounting at the same time) share one network request and one cache
 * write. Keyed by the manifest cache key; the entry is cleared once it settles.
 */
const inFlight = new Map<string, Promise<SdkResolveResponse>>();

const runResolve = async ({
  apiBaseUrl,
  publishableKey,
  channelId,
  config,
  fetcher,
  cacheKey,
}: Required<Pick<ResolveManifestParams, 'apiBaseUrl' | 'publishableKey' | 'channelId' | 'config'>> & {
  fetcher: typeof fetch;
  cacheKey: string;
}): Promise<SdkResolveResponse> => {
  const cached = await loadManifestResolveCache(cacheKey);
  const headers: Record<string, string> = {
    authorization: `Bearer ${publishableKey}`,
    'content-type': 'application/json',
    'x-rheo-channel': channelId,
  };
  if (shouldSendManifestConditional(cached)) {
    headers['if-none-match'] = cached.etag;
  }

  const response = await fetcher(`${apiBaseUrl}/v1/sdk/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      identity: { appUserId: getResolvedAppUserId(config) },
      context: config.locale ? { locale: config.locale } : undefined,
    }),
  });

  if (response.status === 304) {
    if (!shouldSendManifestConditional(cached)) {
      throw new Error('resolve returned 304 without a local manifest cache entry');
    }
    return cached.body;
  }

  if (!response.ok) {
    throw await mapChannelError(response);
  }

  const data = (await response.json()) as SdkResolveResponse;
  const etag = parseEtag(response);
  if (etag) {
    await saveManifestResolveCache(cacheKey, {
      etag,
      body: data,
      cachedAt: Date.now(),
    });
  }
  return data;
};

export const resolveManifest = ({
  apiBaseUrl,
  publishableKey,
  channelId,
  config,
  fetcher = config.fetcher ?? fetch,
}: ResolveManifestParams): Promise<SdkResolveResponse> => {
  const cacheKey = manifestResolveCacheKey(apiBaseUrl, publishableKey, channelId, config.locale);
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = runResolve({
    apiBaseUrl,
    publishableKey,
    channelId,
    config,
    fetcher,
    cacheKey,
  }).finally(() => {
    inFlight.delete(cacheKey);
  });
  inFlight.set(cacheKey, promise);
  return promise;
};
